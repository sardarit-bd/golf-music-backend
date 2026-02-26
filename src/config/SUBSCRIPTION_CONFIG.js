import { SUBSCRIPTION_RULES } from "./subscriptionRules.js";

export const SUBSCRIPTION_CONFIG = {

  // =====================================================
  // 🔥 BILLING SYSTEM (ALWAYS ACTIVE - NO MASTER SWITCH)
  // =====================================================
  BILLING: {
    ENABLE_BILLING: true, // Marketplace commission always active

    // Marketplace commission control
    MARKETPLACE_FEE_PERCENT: {
      free: 10, // Free users → 10%
      pro: 0,   // Pro users → 0%
    },

    // Pro plan pricing
    PRO_MONTHLY_PRICE: 10, // $10/month
    PRO_YEARLY_PRICE: 100,
    CURRENCY: "USD",
  },

  // =====================================================
  // 🧩 FEATURE SUBSCRIPTION SYSTEM (FUTURE USE)
  // =====================================================
  FEATURE_SUBSCRIPTION: {
    ENABLE_FEATURE_SUBSCRIPTIONS: false, // 🔥 Turn ON only when full SaaS mode needed
    DEFAULT_PLAN: "free",
    FORCE_FREE_FOR_ALL: true,
  },

  // =====================================================
  // 📦 FEATURE LIMITS (Only used if feature subscription ON)
  // =====================================================
  FEATURES: {
    MAX_PHOTOS: {
      free: 5,
      pro: 10,
    },

    MAX_MP3: {
      free: 5,
      pro: 10,
    },

    MAX_VIDEOS: {
      free: 5,
      pro: 10,
    },

    MAX_SHOWS_PER_MONTH: {
      free: 5,
      pro: 999,
    },

    ENABLE_ANALYTICS: true,
    ENABLE_ADVANCED_FEATURES: true,
  },

  // =====================================================
  // 🎨 UI CONTROLS (Optional)
  // =====================================================
  UI: {
    SHOW_UPGRADE_BUTTONS: false,
    SHOW_PLAN_BADGES: false,
    SHOW_FEATURE_COMPARISON: false,
    HIGHLIGHT_PRO_FEATURES: false,
  },

  // =====================================================
  // 🌐 API CONTROLS
  // =====================================================
  API: {
    ENABLE_SUBSCRIPTION_ENDPOINTS: false,
    ENABLE_STRIPE_WEBHOOKS: false,
    ENABLE_BILLING_PORTAL: false,
  },
};

// =====================================================
// 🔹 BILLING HELPER (MARKETPLACE ONLY)
// =====================================================

export const getMarketplaceFeePercent = (plan = "free") => {
  return (
    SUBSCRIPTION_CONFIG.BILLING.MARKETPLACE_FEE_PERCENT[plan] ?? 10
  );
};

export const calculateMarketplaceCommission = (price, plan = "free") => {
  const percent = getMarketplaceFeePercent(plan);
  const rate = percent / 100;
  return Math.round(price * rate * 100) / 100;
};

// =====================================================
// 🔹 FEATURE SUBSCRIPTION HELPERS
// =====================================================

/**
 * Check if feature subscription system is enabled
 */
export const isFeatureSubscriptionEnabled = () => {
  return SUBSCRIPTION_CONFIG.FEATURE_SUBSCRIPTION.ENABLE_FEATURE_SUBSCRIPTIONS;
};

/**
 * Get effective plan considering system settings
 */
export const getEffectiveFeaturePlan = (userPlan = "free") => {
  if (!isFeatureSubscriptionEnabled()) {
    return "free";
  }

  if (SUBSCRIPTION_CONFIG.FEATURE_SUBSCRIPTION.FORCE_FREE_FOR_ALL) {
    return "free";
  }

  return userPlan || SUBSCRIPTION_CONFIG.FEATURE_SUBSCRIPTION.DEFAULT_PLAN;
};

/**
 * Get plan rules for a specific user type
 */
export const getPlanRules = (userType, userPlan = "free") => {
  const activePlan = getEffectiveFeaturePlan(userPlan);

  return (
    SUBSCRIPTION_RULES[userType]?.[activePlan] ||
    SUBSCRIPTION_RULES[userType]?.free
  );
};

// =====================================================
// 🔹 ADDITIONAL HELPER FUNCTIONS (যা venue controller এ দরকার)
// =====================================================

/**
 * Check if subscriptions are enabled globally
 * (Alias for isFeatureSubscriptionEnabled for backward compatibility)
 */
export const isSubscriptionEnabled = () => {
  return isFeatureSubscriptionEnabled();
};

/**
 * Get subscription status for a user
 */
export const getUserSubscriptionStatus = (user) => {
  if (!user) {
    return {
      plan: "free",
      isActive: false,
      limits: getPlanRules("venue", "free")
    };
  }

  const effectivePlan = getEffectiveFeaturePlan(user.subscriptionPlan);
  const isActive = effectivePlan === "pro" && 
                   ["active", "trialing"].includes(user.subscriptionStatus);

  return {
    plan: effectivePlan,
    originalPlan: user.subscriptionPlan,
    status: user.subscriptionStatus,
    isActive,
    limits: getPlanRules(user.userType, effectivePlan)
  };
};

/**
 * Check if user can access a specific feature
 */
export const canAccessFeature = (user, feature, userType = "venue") => {
  const effectivePlan = getEffectiveFeaturePlan(user?.subscriptionPlan);
  const rules = getPlanRules(userType || user?.userType, effectivePlan);
  
  return rules[feature] === true;
};

/**
 * Get maximum number of photos allowed
 */
export const getMaxPhotos = (user) => {
  const effectivePlan = getEffectiveFeaturePlan(user?.subscriptionPlan);
  return SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS[effectivePlan] || 5;
};

/**
 * Get maximum number of shows per month
 */
export const getMaxShows = (user) => {
  const effectivePlan = getEffectiveFeaturePlan(user?.subscriptionPlan);
  return SUBSCRIPTION_CONFIG.FEATURES.MAX_SHOWS_PER_MONTH[effectivePlan] || 5;
};