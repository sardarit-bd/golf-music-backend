import { stripe } from "../config/stripe.js";
import User from "../models/model.user.js";

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    /* ===============================
       CHECKOUT COMPLETED (PRIMARY)
    =============================== */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.mode === "subscription") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription
        );

        const userId = subscription.metadata?.userId;

        if (userId) {
          await User.findByIdAndUpdate(userId, {
            subscriptionPlan: "pro",
            subscriptionStatus: subscription.status,
            stripeSubscriptionId: subscription.id,
            trialUsed: !!subscription.trial_end,
            trialStartedAt: subscription.trial_start
              ? new Date(subscription.trial_start * 1000)
              : null,
            trialEndsAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          });
        }
      }
    }

    /* ===============================
       SUBSCRIPTION DELETED
    =============================== */
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;

      await User.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        {
          subscriptionPlan: "free",
          subscriptionStatus: "expired",
          stripeSubscriptionId: null,
          trialEndsAt: null,
        }
      );
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).send(`Webhook handler failed: ${err.message}`);
  }
};
