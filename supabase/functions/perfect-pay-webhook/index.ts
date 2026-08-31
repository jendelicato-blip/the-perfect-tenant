// Webhook receiver for Perfect Pay™ rent payment events. Deploy with
// `verify_jwt = false` — same reasoning as stripe-webhook (subscription
// billing): the provider can't send a Supabase JWT, so the signed
// `Stripe-Signature` header (verified below against
// PERFECT_PAY_WEBHOOK_SECRET) is what authenticates the caller instead.
//
// IMPORTANT — this is the RECEIVING half of a two-sided integration whose
// SENDING half doesn't exist yet. Nothing in this app currently creates a
// Stripe PaymentIntent or Connect transfer for rent — Perfect Pay is Phase 1
// landlord-confirmed only (see the note above payment_verifications in
// 0005_perfect_rent_pay_rewards.sql). Until a real charge-creation flow is
// built, nothing ever calls this endpoint: it's real, correct, and
// currently unreachable, not a fabricated integration. When that flow is
// built, every PaymentIntent/Charge it creates MUST carry
// metadata: { tenant_id, property_id, period_start } — the same natural key
// recordPayment already uses for payment_verifications — so this handler
// can attribute the event without a new correlation-id column.
//
// Register this function's URL as a webhook endpoint in the Stripe
// dashboard (a separate endpoint from the one stripe-webhook uses, since
// this is Connect-side payment events, not platform-side subscription
// events) listening for:
//   payment_intent.succeeded, payment_intent.payment_failed,
//   payment_intent.processing, charge.refunded, charge.dispute.created,
//   payout.paid, payout.failed
//
// Required secrets: STRIPE_SECRET_KEY, PERFECT_PAY_WEBHOOK_SECRET (falls
// back to STRIPE_WEBHOOK_SECRET if only one endpoint is registered)

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("PERFECT_PAY_WEBHOOK_SECRET") ?? Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

interface PaymentMetadata {
  tenantId: string;
  propertyId: string;
  periodStart: string;
}

function readPaymentMetadata(obj: { metadata?: Stripe.Metadata | null }): PaymentMetadata | null {
  const tenantId = obj.metadata?.tenant_id;
  const propertyId = obj.metadata?.property_id;
  const periodStart = obj.metadata?.period_start;
  if (!tenantId || !propertyId || !periodStart) return null;
  return { tenantId, propertyId, periodStart };
}

async function audit(action: string, targetTable: string, targetId: string) {
  // audit_logs exists in the schema (0001) but had nothing writing to it
  // until now — this is its first real writer.
  await service.from("audit_logs").insert({ user_id: null, action, target_table: targetTable, target_id: targetId });
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const meta = readPaymentMetadata(intent);
  if (!meta) return;
  const { data: property } = await service.from("properties").select("landlord_id").eq("id", meta.propertyId).maybeSingle();
  if (!property) return;

  // Same natural key and upsert-by-conflict pattern recordPayment already
  // uses — a payment processor is simply another legitimate verified_by
  // source, exactly what that column was designed to admit.
  await service.from("payment_verifications").upsert(
    {
      tenant_id: meta.tenantId,
      property_id: meta.propertyId,
      landlord_id: property.landlord_id,
      period_start: meta.periodStart,
      status: "on_time",
      verified_by: "payment_processor",
      verified_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,property_id,period_start" },
  );
  await service.from("notifications").insert({
    user_id: meta.tenantId,
    type: "payment_processor_succeeded",
    body: "Your rent payment was successfully processed.",
  });
  await audit("payment_intent.succeeded", "payment_verifications", intent.id);
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  const meta = readPaymentMetadata(intent);
  if (!meta) return;
  // A failed attempt was never confirmed — it must never create a
  // payment_verifications row (that table only ever records a real,
  // affirmed payment). The tenant still needs to know.
  await service.from("notifications").insert({
    user_id: meta.tenantId,
    type: "payment_processor_failed",
    body: "Your Perfect Pay rent payment failed. Please check your payment method.",
  });
  await audit("payment_intent.payment_failed", "payment_verifications", intent.id);
}

async function handleRefund(charge: Stripe.Charge) {
  const meta = readPaymentMetadata(charge);
  if (!meta) return;
  const { data: payment } = await service
    .from("payment_verifications")
    .select("id, landlord_id, tenant_id")
    .eq("tenant_id", meta.tenantId)
    .eq("property_id", meta.propertyId)
    .eq("period_start", meta.periodStart)
    .maybeSingle();
  if (!payment) return;

  await service.from("payment_refunds").insert({
    payment_verification_id: payment.id,
    landlord_id: payment.landlord_id,
    tenant_id: payment.tenant_id,
    amount_cents: charge.amount_refunded,
    type: charge.amount_refunded >= charge.amount ? "full" : "partial",
    reason: "Refund processed by payment provider.",
  });
  await audit("charge.refunded", "payment_refunds", charge.id);
}

async function handleChargeback(dispute: Stripe.Dispute) {
  const charge = await stripe.charges.retrieve(dispute.charge as string);
  const meta = readPaymentMetadata(charge);
  if (!meta) return;
  const { data: payment } = await service
    .from("payment_verifications")
    .select("id, landlord_id")
    .eq("tenant_id", meta.tenantId)
    .eq("property_id", meta.propertyId)
    .eq("period_start", meta.periodStart)
    .maybeSingle();
  if (!payment) return;

  // A card-network chargeback is filed by the tenant's bank, not the
  // tenant directly clicking "Dispute" in-app — reporter_id is still the
  // tenant (they're the one the chargeback is on behalf of), same
  // disputes table the in-app tenant-filed flow uses (fileDispute), just a
  // different real-world origin for the same row shape.
  await service.from("disputes").insert({
    reporter_id: meta.tenantId,
    subject_id: payment.landlord_id,
    reason: `Card network chargeback: ${dispute.reason}`,
    status: "open",
    payment_verification_id: payment.id,
    category: "other",
  });
  await audit("charge.dispute.created", "disputes", dispute.id);
}

async function handlePayout(payout: Stripe.Payout, failed: boolean) {
  const landlordId = payout.metadata?.landlord_id;
  if (!landlordId) return;
  if (failed) {
    await service.from("notifications").insert({
      user_id: landlordId,
      type: "payout_failed",
      body: "A payout to your connected account failed. Please check your Perfect Pay settings.",
    });
  }
  await audit(failed ? "payout.failed" : "payout.paid", "landlord_payout_accounts", payout.id);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  // Claim this event id before doing any real work. A unique-violation here
  // means a prior delivery of the same event already claimed it — skip
  // rather than reprocess (Stripe's delivery guarantee is at-least-once,
  // never exactly-once). Never process the same payment twice.
  const { error: claimError } = await service.from("webhook_events").insert({ id: event.id, type: event.type });
  if (claimError) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleRefund(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        await handleChargeback(event.data.object as Stripe.Dispute);
        break;
      case "payout.paid":
        await handlePayout(event.data.object as Stripe.Payout, false);
        break;
      case "payout.failed":
        await handlePayout(event.data.object as Stripe.Payout, true);
        break;
      default:
        break;
    }
  } catch (err) {
    // Leave processed_at null — a future manual/automated audit can find
    // "claimed but never finished" rows and re-drive them. Still return
    // 500 so Stripe's own retry schedule gets a chance to redeliver first.
    console.error(`perfect-pay-webhook: failed to process ${event.type} (${event.id}):`, err);
    return new Response("Internal error processing webhook", { status: 500 });
  }

  await service.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
