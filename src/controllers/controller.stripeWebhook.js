import { stripe } from "../config/stripe.js";
import { handleMerchWebhook } from "./controller.merchWebhook.js";
import { handleSubscriptionWebhook } from "./controller.subscriptionWebhook.js";

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
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await handleMerchWebhook(event);

    await handleSubscriptionWebhook(event);

    res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    res.status(500).send("Webhook handler failed");
  }
};
