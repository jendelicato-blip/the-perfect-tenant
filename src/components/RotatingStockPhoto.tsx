import { useEffect, useState } from "react";
import { getRotatingPhoto, UNSPLASH_HOME_URL, type UnsplashPhoto } from "@/lib/unsplash";

// Drop-in replacement for a fixed <img> stock photo: shows a live Unsplash
// photo that rotates on a schedule (see ROTATE_EVERY_MS in lib/unsplash.ts)
// when VITE_UNSPLASH_ACCESS_KEY is configured, otherwise renders
// fallbackSrc/fallbackAlt unchanged — see lib/unsplash.ts for the fallback
// reasoning and the attribution requirement this satisfies.
export function RotatingStockPhoto({
  spotKey,
  query,
  fallbackSrc,
  fallbackAlt,
  className = "h-96 w-full object-cover",
}: {
  spotKey: string;
  query: string;
  fallbackSrc: string;
  fallbackAlt: string;
  className?: string;
}) {
  const [photo, setPhoto] = useState<UnsplashPhoto | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRotatingPhoto(spotKey, query).then((p) => {
      if (!cancelled) setPhoto(p);
    });
    return () => {
      cancelled = true;
    };
  }, [spotKey, query]);

  return (
    <div className="relative">
      <img src={photo?.imageUrl ?? fallbackSrc} alt={photo ? query : fallbackAlt} className={className} />
      {photo && (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
          Photo by{" "}
          <a href={photo.photographerProfileUrl} target="_blank" rel="noreferrer" className="hover:underline">
            {photo.photographerName}
          </a>{" "}
          on{" "}
          <a href={UNSPLASH_HOME_URL} target="_blank" rel="noreferrer" className="hover:underline">
            Unsplash
          </a>
        </span>
      )}
    </div>
  );
}
