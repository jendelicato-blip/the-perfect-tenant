// Live Unsplash integration for marketing-page stock photos. Every hero
// photo on the site is otherwise a single fixed URL committed to the repo —
// this replaces that with a real photo pulled from Unsplash's Random Photo
// API on a rotation schedule, per spot, so the marketing pages don't look
// frozen in time. Falls back to the fixed URL already in each page when no
// key is configured, so nothing breaks without one (same pattern as
// isSupabaseConfigured in lib/data/supabaseClient.ts).
//
// Setup: create a free app at https://unsplash.com/developers, copy its
// Access Key into VITE_UNSPLASH_ACCESS_KEY (see .env.example). Unsplash's
// API guidelines (https://help.unsplash.com/en/articles/2511245) require,
// for every photo actually used (not just downloaded): (1) visible credit
// linking back to the photographer and to Unsplash, both UTM-tagged, and
// (2) a ping to the photo's download_location endpoint. Both are handled
// here and in RotatingStockPhoto — don't hotlink an Unsplash photo elsewhere
// in the app without doing both.
//
// Demo (unapproved) Unsplash apps are capped at 50 requests/hour — fine for
// this, since each spot only fetches once per rotation window (see
// ROTATE_EVERY_MS below), not once per page view.

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined;
const APP_NAME = (import.meta.env.VITE_UNSPLASH_APP_NAME as string | undefined) ?? "perfect10ant";

export const isUnsplashConfigured = Boolean(ACCESS_KEY);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const ROTATE_EVERY_MS = 7 * ONE_DAY_MS;

export interface UnsplashPhoto {
  imageUrl: string;
  photographerName: string;
  photographerProfileUrl: string;
  photoPageUrl: string;
}

export const UNSPLASH_HOME_URL = withUtm("https://unsplash.com/");

function withUtm(url: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", APP_NAME);
  u.searchParams.set("utm_medium", "referral");
  return u.toString();
}

async function fetchRandomPhoto(query: string): Promise<UnsplashPhoto | null> {
  if (!ACCESS_KEY) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Required by Unsplash's API guidelines whenever a photo is actually
    // used (hotlinked and displayed counts, not just an explicit user
    // download) — fire-and-forget, a failure here shouldn't block display.
    fetch(`${data.links.download_location}&client_id=${ACCESS_KEY}`).catch(() => {});

    return {
      imageUrl: data.urls.regular as string,
      photographerName: data.user.name as string,
      photographerProfileUrl: withUtm(data.user.links.html as string),
      photoPageUrl: withUtm(data.links.html as string),
    };
  } catch {
    return null;
  }
}

interface CachedPhoto {
  photo: UnsplashPhoto;
  fetchedAt: number;
}

function cacheKey(spotKey: string): string {
  return `unsplash-rotating-photo:${spotKey}`;
}

function readCache(spotKey: string): CachedPhoto | null {
  try {
    const raw = localStorage.getItem(cacheKey(spotKey));
    return raw ? (JSON.parse(raw) as CachedPhoto) : null;
  } catch {
    return null;
  }
}

function writeCache(spotKey: string, entry: CachedPhoto) {
  try {
    localStorage.setItem(cacheKey(spotKey), JSON.stringify(entry));
  } catch {
    // localStorage unavailable (private browsing, quota) — rotation just
    // re-fetches every load instead of persisting; not worth failing over.
  }
}

// One rotating photo per named spot (e.g. "landing-hero"), refreshed at
// most once per ROTATE_EVERY_MS. Returns null when unconfigured, on a
// first-ever fetch failure, or content_filter rejection — callers should
// fall back to their existing static image in all of those cases.
export async function getRotatingPhoto(spotKey: string, query: string): Promise<UnsplashPhoto | null> {
  if (!ACCESS_KEY) return null;

  const cached = readCache(spotKey);
  if (cached && Date.now() - cached.fetchedAt < ROTATE_EVERY_MS) {
    return cached.photo;
  }

  const fresh = await fetchRandomPhoto(query);
  if (fresh) {
    writeCache(spotKey, { photo: fresh, fetchedAt: Date.now() });
    return fresh;
  }

  // Fetch failed (rate limit, network) — prefer a stale cached photo over
  // nothing, since it's still a real, previously-fetched Unsplash photo.
  return cached?.photo ?? null;
}
