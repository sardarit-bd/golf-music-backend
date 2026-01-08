import { stripe } from "../config/stripe.js";
import User from "../models/model.user.js";


export const handleSubscriptionWebhook = async (event) => {
  try {

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Only subscription checkouts
      if (session.mode !== "subscription") return;

      if (!session.subscription) {
        console.warn("⚠️ Subscription ID missing in checkout session");
        return;
      }

      // Fetch full subscription
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription
      );

      const userId = subscription.metadata?.userId;
      if (!userId) {
        console.warn("⚠️ userId missing in subscription metadata");
        return;
      }

      await User.findByIdAndUpdate(userId, {
        subscriptionPlan: "pro",
        subscriptionStatus: subscription.status,
        stripeSubscriptionId: subscription.id,

        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,

        trialUsed: !!subscription.trial_end,
        trialStartedAt: subscription.trial_start
          ? new Date(subscription.trial_start * 1000)
          : null,
        trialEndsAt: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      });

      // console.log("Subscription checkout completed:", subscription.id);
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;

      await User.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        {
          subscriptionStatus: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          trialEndsAt: sub.trial_end
            ? new Date(sub.trial_end * 1000)
            : null,
        }
      );

      // console.log(
      //   "🔄 Subscription updated:",
      //   sub.id,
      //   sub.status,
      //   "cancel_at_period_end:",
      //   sub.cancel_at_period_end
      // );
    }


    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;

      await User.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        {
          subscriptionPlan: "free",
          subscriptionStatus: "expired",
          stripeSubscriptionId: null,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        }
      );

      // console.log("❌ Subscription fully cancelled:", sub.id);
    }
  } catch (err) {
    console.error("❌ Subscription webhook error:", err.message);
    throw err;
  }
};
