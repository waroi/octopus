import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, getStripe } from "@/lib/stripe";
import { addCredits, deductCredits } from "@/lib/credits";
import { prisma } from "@octopus/db";

async function getReceiptUrl(paymentIntentId: string | null): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const charges = await getStripe().charges.list({ payment_intent: paymentIntentId, limit: 1 });
    return charges.data[0]?.receipt_url ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orgId = session.metadata?.orgId;
    const type = session.metadata?.type;
    const amountUsd = Number(session.metadata?.amountUsd || 0);

    if (orgId && type === "credit_purchase" && amountUsd > 0) {
      try {
        await addCredits(
          orgId,
          amountUsd,
          "purchase",
          `Credit purchase — $${amountUsd}`,
          session.id,
        );

        // Fetch and store receipt URL
        const receiptUrl = await getReceiptUrl(
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        );
        if (receiptUrl) {
          await prisma.creditTransaction.update({
            where: { stripeSessionId: session.id },
            data: { receiptUrl },
          });
        }
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.message.includes("Unique constraint")
        ) {
          console.log("[stripe-webhook] Duplicate session, skipping:", session.id);
        } else {
          console.error("[stripe-webhook] Failed to add credits:", err);
        }
      }
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;

    if (paymentIntentId) {
      // Find the original transaction by looking up the checkout session tied to this payment intent
      const sessions = await getStripe().checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
      const checkoutSession = sessions.data[0];
      const orgId = checkoutSession?.metadata?.orgId;
      const amountRefunded = charge.amount_refunded / 100;

      if (orgId && amountRefunded > 0) {
        try {
          await deductCredits(orgId, amountRefunded, `Refund — $${amountRefunded}`);
          console.log(`[stripe-webhook] Refund processed: $${amountRefunded} for org ${orgId}`);
        } catch (err) {
          console.error("[stripe-webhook] Failed to process refund:", err);
        }
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object;
    console.error("[stripe-webhook] Payment failed:", intent.id, intent.last_payment_error?.message);
  }

  return NextResponse.json({ received: true });
}
