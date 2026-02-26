import { stripe } from "../config/stripe.js";
import User from "../models/model.user.js";
import Order from "../models/model.order.js"; // ✅ যোগ করুন

/**
 * =====================================================
 * HANDLE MERCH/MARKET CHECKOUT
 * =====================================================
 */
const handleMerchWebhook = async (session) => {
  console.log("🛍️ Processing merch checkout:", session.id);
  
  try {
    if (session.mode === "payment") {
      const orderId = session.metadata?.orderId;
      
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: "paid",
          stripePaymentIntentId: session.payment_intent,
          stripeSessionId: session.id,
          paidAt: new Date(),
        });
        
        console.log(`✅ Order ${orderId} marked as paid`);
      }
    }
  } catch (error) {
    console.error("❌ Error in handleMerchWebhook:", error);
  }
};

/**
 * =====================================================
 * HANDLE SUBSCRIPTION CHECKOUT
 * =====================================================
 */
const handleSubscriptionWebhook = async (event) => {
  console.log("📦 Processing subscription webhook:", event.type);
  
  try {
    // Checkout completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.mode === "subscription") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription
        );

        const userId = subscription.metadata?.userId || session.metadata?.userId;

        if (userId) {
          const user = await User.findById(userId);
          
          if (user) {
            const trialStart = subscription.trial_start 
              ? new Date(subscription.trial_start * 1000) 
              : null;
            
            const trialEnd = subscription.trial_end 
              ? new Date(subscription.trial_end * 1000) 
              : null;

            user.subscriptionPlan = "pro";
            user.subscriptionStatus = subscription.status;
            user.stripeSubscriptionId = subscription.id;
            user.stripeCustomerId = session.customer;
            user.cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
            
            if (trialStart) user.trialStartedAt = trialStart;
            if (trialEnd) {
              user.trialEndsAt = trialEnd;
              user.trialUsed = true;
            }
            
            await user.save();
            
            console.log(`✅ Pro subscription activated for user: ${userId}`);
          }
        }
      }
    }

    // Subscription updated
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          subscriptionStatus: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        });
        
        console.log(`📝 Subscription updated for user ${userId}: ${subscription.status}`);
      }
    }

    // Subscription deleted
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          subscriptionPlan: "free",
          subscriptionStatus: "expired",
          stripeSubscriptionId: null,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        });
        
        console.log(`❌ Subscription canceled for user ${userId}`);
      } else {
        await User.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          {
            subscriptionPlan: "free",
            subscriptionStatus: "expired",
            stripeSubscriptionId: null,
            trialEndsAt: null,
            cancelAtPeriodEnd: false,
          }
        );
      }
    }

    // Invoice payment succeeded (renewals)
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          await User.findByIdAndUpdate(userId, {
            subscriptionStatus: "active",
          });
          console.log(`💰 Renewal payment succeeded for user ${userId}`);
        }
      }
    }

  } catch (error) {
    console.error("❌ Error in handleSubscriptionWebhook:", error);
  }
};

/**
 * =====================================================
 * MAIN WEBHOOK HANDLER
 * =====================================================
 */
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
    console.error("❌ Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log("🔔 Stripe Event:", event.type);

    /* ===============================
       CHECKOUT COMPLETED
    =============================== */
    if (event.type === "checkout.session.completed") {
      await handleMerchWebhook(event.data.object);
      await handleSubscriptionWebhook(event);
    }

    /* ===============================
       SUBSCRIPTION UPDATED/DELETED
    =============================== */
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionWebhook(event);
    }

    /* ===============================
       INVOICE PAYMENT
    =============================== */
    if (event.type === "invoice.payment_succeeded") {
      await handleSubscriptionWebhook(event);
    }

    res.json({ received: true });

  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    // Always return 200 to Stripe
    res.json({ received: true });
  }
};