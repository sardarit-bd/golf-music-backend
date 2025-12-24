import { stripe } from "../config/stripe.js";
import User from "../models/model.user.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";

const ALLOWED_SUBSCRIBERS = ["artist", "venue", "photographer"];

/* =====================================================
   CREATE STRIPE CHECKOUT SESSION (ONLY ENTRY POINT)
===================================================== */
export const createProCheckoutSession = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return next(new ErrorResponse("User not found", 404));

  if (!ALLOWED_SUBSCRIBERS.includes(user.userType)) {
    return next(
      new ErrorResponse(
        "Subscription is only available for Artists, Venues, and Photographers",
        403
      )
    );
  }

  // block only if user already has Pro access
  if (
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing"
  ) {
    return next(new ErrorResponse("Already on Pro plan", 400));
  }

  // cleanup broken incomplete subscription
  if (user.subscriptionStatus === "incomplete" && user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.del(user.stripeSubscriptionId);
    } catch (err) {
      console.warn("Failed to clean incomplete subscription:", err.message);
    }

    user.subscriptionPlan = "free";
    user.subscriptionStatus = "none";
    user.stripeSubscriptionId = null;
    await user.save();
  }

  // ensure Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.username,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  const rules = SUBSCRIPTION_RULES[user.userType]?.pro;
  const trialDays = user.trialUsed ? 0 : rules.trialDays;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: process.env.STRIPE_PRICE_PRO,
        quantity: 1,
      },
    ],
    subscription_data: {
      ...(trialDays
        ? { trial_period_days: trialDays }
        : {}),
      metadata: {
        userId: user._id.toString(),
      },
    },
    payment_method_collection: "always",
    allow_promotion_codes: true,
    success_url: `${process.env.CLIENT_URL}/billing/success`,
    cancel_url: `${process.env.CLIENT_URL}/billing/cancel`,
  });

  res.status(200).json({
    success: true,
    url: session.url,
  });
});

/* =====================================================
   CANCEL SUBSCRIPTION
===================================================== */
export const cancelSubscription = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user || !user.stripeSubscriptionId) {
    return next(new ErrorResponse("No active subscription found", 400));
  }

  await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  user.subscriptionStatus = "canceled";
  await user.save();

  res.status(200).json({
    success: true,
    message: "Subscription will cancel at period end",
  });
});


export const getBillingStatus = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) return next(new ErrorResponse("User not found", 404));

  let stripeSub = null;

  if (user.stripeSubscriptionId) {
    stripeSub = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId
    );
  }

  res.json({
    success: true,
    data: {
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      currentPeriodEnd: stripeSub
        ? new Date(stripeSub.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: stripeSub?.cancel_at_period_end || false,
    },
  });
});

export const createBillingPortalSession = asyncHandler(
  async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (!user || !user.stripeCustomerId) {
      return next(new ErrorResponse("No billing account found", 400));
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL}/dashboard?tab=billing`,
    });

    res.json({
      success: true,
      url: session.url,
    });
  }
);

export const resumeSubscription = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user || !user.stripeSubscriptionId) {
    return next(new ErrorResponse("No subscription found", 400));
  }

  await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  user.subscriptionStatus = "active";
  await user.save();

  res.json({
    success: true,
    message: "Subscription resumed successfully",
  });
});

