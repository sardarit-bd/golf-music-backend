import { stripe } from "../config/stripe.js";
import User from "../models/model.user.js";
import Order from "../models/model.order.js";
import MarketItem from "../models/model.marketItem.js";

/**
 * =====================================================
 * HANDLE MERCH/MARKET CHECKOUT (REGULAR PURCHASES)
 * =====================================================
 */
const handleMerchWebhook = async (event) => {
  const session = event.data.object;
  
  console.log("🛍️ Processing merch checkout:", session.id);
  
  try {
    // For market/merch purchases (not subscriptions)
    if (session.mode === "payment") {
      const orderId = session.metadata?.orderId;
      const orderType = session.metadata?.type; // 'market' or 'merch'
      
      if (orderId) {
        const updateData = {
          paymentStatus: "paid",
          stripePaymentIntentId: session.payment_intent,
          stripeSessionId: session.id,
          paidAt: new Date(),
        };

        await Order.findByIdAndUpdate(orderId, updateData);
        
        console.log(`✅ Order ${orderId} (${orderType || 'unknown'}) marked as paid`);
        
        // If it's a market item, update the item status to sold
        if (orderType === 'market') {
          const order = await Order.findById(orderId);
          if (order && order.marketItem) {
            await MarketItem.findByIdAndUpdate(order.marketItem, { 
              status: 'sold' 
            });
            console.log(`✅ Market item ${order.marketItem} marked as sold`);
          }
        }
      } else {
        console.log("⚠️ No orderId found in session metadata");
      }
    }
  } catch (error) {
    console.error("❌ Error in handleMerchWebhook:", error);
  }
};

/**
 * =====================================================
 * HANDLE SUBSCRIPTION CHECKOUT (PRO PLAN - $10/month)
 * =====================================================
 */
const handleSubscriptionWebhook = async (event) => {
  console.log("📦 Processing subscription webhook:", event.type);
  
  try {
    // =============================================
    // CHECKOUT.SESSION.COMPLETED (NEW SUBSCRIPTION)
    // =============================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      
      // Only handle subscription mode
      if (session.mode === "subscription") {
        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription
        );

        // Get userId from metadata (check both places)
        const userId = subscription.metadata?.userId || session.metadata?.userId;
        
        if (!userId) {
          console.error("❌ No userId found in subscription metadata");
          return;
        }

        // Find user
        const user = await User.findById(userId);
        
        if (!user) {
          console.error(`❌ User not found: ${userId}`);
          return;
        }

        // Calculate trial dates if any
        const trialStart = subscription.trial_start 
          ? new Date(subscription.trial_start * 1000) 
          : null;
        
        const trialEnd = subscription.trial_end 
          ? new Date(subscription.trial_end * 1000) 
          : null;

        // Update user with subscription info
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
        
        console.log(`✅ Pro subscription activated for user: ${userId} (${subscription.status})`);
      }
    }
    
    // =============================================
    // CUSTOMER.SUBSCRIPTION.UPDATED (RENEWAL/CHANGE)
    // =============================================
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      
      // Try to find user by metadata first, then by subscription ID
      let userId = subscription.metadata?.userId;
      let user;
      
      if (userId) {
        user = await User.findById(userId);
      } else {
        user = await User.findOne({ stripeSubscriptionId: subscription.id });
      }
      
      if (user) {
        // Update subscription status
        user.subscriptionStatus = subscription.status;
        user.cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
        
        // Update trial dates if present
        if (subscription.trial_end) {
          user.trialEndsAt = new Date(subscription.trial_end * 1000);
        }
        
        await user.save();
        
        console.log(`📝 Subscription updated for user ${user._id}: ${subscription.status}`);
      } else {
        console.log(`⚠️ No user found for subscription ${subscription.id}`);
      }
    }
    
    // =============================================
    // CUSTOMER.SUBSCRIPTION.DELETED (CANCELLED)
    // =============================================
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      
      // Try to find user by metadata first, then by subscription ID
      let userId = subscription.metadata?.userId;
      let user;
      
      if (userId) {
        user = await User.findById(userId);
      } else {
        user = await User.findOne({ stripeSubscriptionId: subscription.id });
      }
      
      if (user) {
        // Downgrade to free
        user.subscriptionPlan = "free";
        user.subscriptionStatus = "expired";
        user.stripeSubscriptionId = null;
        user.trialEndsAt = null;
        user.cancelAtPeriodEnd = false;
        
        await user.save();
        
        console.log(`❌ Subscription canceled for user ${user._id}`);
      } else {
        console.log(`⚠️ No user found for deleted subscription ${subscription.id}`);
        
        // Fallback: update by stripeSubscriptionId only
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
        
        console.log(`❌ Subscription canceled for unknown user (sub: ${subscription.id})`);
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
    // CHECKOUT SESSION COMPLETED
    // (Handles both one-time payments and subscriptions)
    // =============================
    if (event.type === "checkout.session.completed") {
      // Call both handlers - they check session.mode internally
      await handleMerchWebhook(event);        // For regular purchases (mode: 'payment')
      await handleSubscriptionWebhook(event); // For subscription purchases (mode: 'subscription')
    }

    // =============================
    // SUBSCRIPTION MANAGEMENT EVENTS
    // =============================
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionWebhook(event);
    }

    // =============================
    // INVOICE PAYMENT SUCCEEDED
    // (Monthly subscription renewals)
    // =============================
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      
      // If this is a subscription invoice
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        
        // Update user's subscription status to ensure it's active
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          await User.findByIdAndUpdate(userId, {
            subscriptionStatus: "active",
            subscriptionPlan: "pro",
          });
          console.log(`💰 Subscription payment succeeded for user ${userId}`);
        }
      }
    }

    // =============================
    // INVOICE PAYMENT FAILED
    // =============================
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          await User.findByIdAndUpdate(userId, {
            subscriptionStatus: "past_due",
          });
          console.log(`⚠️ Subscription payment failed for user ${userId}`);
        }
      }
    }

    // =============================
    // CONNECT EVENTS (MARKETPLACE SELLERS)
    // =============================
    if (
      event.type.startsWith("account.") ||
      event.type.startsWith("capability.") ||
      event.type.startsWith("person.")
    ) {
      console.log("🔵 Connect event received:", event.type);
      
      // Handle specific connect events if needed
      if (event.type === "account.updated") {
        const account = event.data.object;
        const userId = account.metadata?.userId;
        
        if (userId) {
          // Update user's Stripe Connect status based on account
          let accountStatus = 'pending';
          if (account.charges_enabled && account.payouts_enabled) {
            accountStatus = 'active';
          } else if (account.requirements?.disabled_reason) {
            accountStatus = 'restricted';
          }
          
          await User.findByIdAndUpdate(userId, {
            stripeAccountStatus: accountStatus,
          });
          
          console.log(`🔄 Stripe Connect account updated for user ${userId}: ${accountStatus}`);
        }
      }
    }

    res.status(200).json({ received: true });

  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    // ALWAYS return 200 to Stripe - even on error
    // This prevents Stripe from retrying the same event
    res.status(200).json({ received: true });
  }
};