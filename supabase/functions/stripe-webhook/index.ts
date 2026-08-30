// Handles Stripe webhook events for subscription lifecycle updates. Deploy
// with `verify_jwt = false` — Stripe cannot send a Supabase JWT; the
// `Stripe-Signature` header (verified below against STRIPE_WEBHOOK_SECRET) is
// what authenticates the caller instead. Register this function's URL as a
// webhook endpoint in the Stripe dashboard listening for:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted
//
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// (STRIPE_PRICE_* are read here too, to map a Stripe price back to our tier)

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const TIER_BY_PRICE: Record<string, "starter" | "growth" | "portfolio"> = {
  [Deno.env.get("STRIPE_PRICE_STARTER") ?? ""]: "starter",
  [Deno.env.get("STRIPE_PRICE_GROWTH") ?? ""]: "growth",
  [Deno.env.get("STRIPE_PRICE_PORTFOLIO") ?? ""]: "portfolio",
};

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function upsertFromSubscription(landlordId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const tier = (priceId && TIER_BY_PRICE[priceId]) || "starter";
  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? subscription.status
      : subscription.status === "past_due"
        ? "past_due"
        : "canceled";

  await service
    .from("subscriptions")
    .update({
      tier,
      status,
      stripe_customer_id: subscription.customer as string,
      renews_at: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq("landlord_id", landlordId);
  await service.from("landlords").update({ subscription_tier: tier }).eq("user_id", landlordId);
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const landlordId = session.metadata?.landlord_id;
      if (landlordId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertFromSubscription(landlordId, subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const landlordId = subscription.metadata?.landlord_id;
      if (landlordId) {
        await upsertFromSubscription(landlordId, subscription);
      }
      break;
    }
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
