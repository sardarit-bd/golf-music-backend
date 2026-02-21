import { stripe } from "../config/stripe.js";

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log("🔔 Stripe Event:", event.type);

    // =============================
    // MARKET + MERCH EVENTS
    // =============================
    if (
      event.type === "checkout.session.completed"
    ) {
      await handleMerchWebhook(event);
      await handleSubscriptionWebhook(event);
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionWebhook(event);
    }

    // =============================
    // CONNECT EVENTS (IMPORTANT)
    // =============================
    if (
      event.type.startsWith("account.") ||
      event.type.startsWith("capability.") ||
      event.type.startsWith("person.")
    ) {
      console.log("🔵 Connect event received:", event.type);
    }

    res.status(200).json({ received: true });

  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    // NEVER RETURN 400 HERE
    res.status(200).json({ received: true });
  }
};