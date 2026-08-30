// Creates a Stripe Checkout session for a landlord's chosen subscription tier.
// Deploy with `verify_jwt = true` (the default) — the caller's Supabase JWT
// is what identifies which landlord is checking out; Stripe itself is never
// trusted with that decision.
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   STRIPE_SECRET_KEY        sk_test_... (or live key in production)
//   STRIPE_PRICE_STARTER     price_... for the Starter tier
//   STRIPE_PRICE_GROWTH      price_... for the Growth tier
//   STRIPE_PRICE_PORTFOLIO   price_... for the Portfolio tier
//   PUBLIC_SITE_URL          e.g. https://your-app.vercel.app (for redirect back)
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into every Edge Function — do not set them yourself.

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

const PRICE_BY_TIER: Record<string, string | undefined> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER"),
  growth: Deno.env.get("STRIPE_PRICE_GROWTH"),
  portfolio: Deno.env.get("STRIPE_PRICE_PORTFOLIO"),
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Not authenticated." }), { status: 401 });
  }
  const landlordId = userData.user.id;

  const { data: landlord } = await supabase.from("landlords").select("user_id").eq("user_id", landlordId).single();
  if (!landlord) {
    return new Response(JSON.stringify({ error: "Only landlords can start checkout." }), { status: 403 });
  }

  const { tier } = await req.json();
  const priceId = PRICE_BY_TIER[tier];
  if (!priceId) {
    return new Response(JSON.stringify({ error: `No Stripe price configured for tier "${tier}".` }), { status: 400 });
  }

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: subscription } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("landlord_id", landlordId)
    .single();

  let customerId = subscription?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.user.email,
      metadata: { landlord_id: landlordId },
    });
    customerId = customer.id;
    await service.from("subscriptions").update({ stripe_customer_id: customerId }).eq("landlord_id", landlordId);
  }

  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/pricing?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    metadata: { landlord_id: landlordId, tier },
    // subscription_data.metadata (not just the session's own metadata above)
    // is what later customer.subscription.updated/deleted webhook events
    // carry — the checkout session itself won't exist by then.
    subscription_data: { metadata: { landlord_id: landlordId } },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
