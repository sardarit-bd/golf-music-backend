/**
 * CENTRAL SUBSCRIPTION CONTROL PANEL
 * subscription plan ON/OFF
 */

import { SUBSCRIPTION_RULES } from "./subscriptionRules.js";

export const SUBSCRIPTION_CONFIG = {
  // ============================================
  // MASTER SWITCH - subscription ON/OFF
  // ============================================
  SYSTEM_WIDE: {
    ENABLE_SUBSCRIPTIONS: false, // true = Pro plan, false = Free plan
    DEFAULT_PLAN: "free", // All users- default plan
    FORCE_FREE_FOR_ALL: true, // Force all users to be on free plan
  },

  // ============================================
  // INDIVIDUAL FEATURE SWITCHES
  // ============================================
  FEATURES: {
    // Payment & Marketplace
    ENABLE_PAYMENTS: false,
    ENABLE_MARKETPLACE: true,
    MARKETPLACE_FEE: {
      free: 0, // Free users- 0% fee
      pro: 0,  // Pro users- 0% fee (if enabled)
    },

    // Upload Limits
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

    // Event/Show Limits
    MAX_SHOWS_PER_MONTH: {
      free: 5,
      pro: 999, // Unlimited
    },

    // Analytics & Advanced Features
    ENABLE_ANALYTICS: true,
    ENABLE_ADVANCED_FEATURES: true,
  },

  // ============================================
  // PLAN PRICING
  // ============================================
  PRICING: {
    PRO_MONTHLY: 10, // $10/month
    PRO_YEARLY: 100, // $100/year (16% discount)
    TRIAL_DAYS: 30,
    CURRENCY: "USD",
  },

  // ============================================
  // UI/UX SETTINGS
  // ============================================
  UI: {
    SHOW_UPGRADE_BUTTONS: false, // Frontend upgrade buttons show 
    SHOW_PLAN_BADGES: false,     // Plan badges show 
    SHOW_FEATURE_COMPARISON: false, // Feature comparison table show 
    HIGHLIGHT_PRO_FEATURES: false,  // Pro features highlight 
  },

  // ============================================
  // API ENDPOINT CONTROLS
  // ============================================
  API: {
    ENABLE_SUBSCRIPTION_ENDPOINTS: false, // /api/subscription/* endpoints
    ENABLE_STRIPE_WEBHOOKS: false,        // Stripe webhooks
    ENABLE_BILLING_PORTAL: false,         // Billing portal
  },
};

/**
 * Helper Functions
 */
export const getActivePlanForUser = (userType) => {
  if (SUBSCRIPTION_CONFIG.SYSTEM_WIDE.FORCE_FREE_FOR_ALL) {
    return "free";
  }
  return SUBSCRIPTION_CONFIG.SYSTEM_WIDE.DEFAULT_PLAN;
};

export const isSubscriptionEnabled = () => {
  return SUBSCRIPTION_CONFIG.SYSTEM_WIDE.ENABLE_SUBSCRIPTIONS;
};

export const getPlanRules = (userType, plan = null) => {
  let activePlan = plan || getActivePlanForUser(userType);
  
  if (!isSubscriptionEnabled()) {
    activePlan = "free";
  }

  // Return appropriate rules based on SUBSCRIPTION_RULES
  return SUBSCRIPTION_RULES[userType]?.[activePlan] || SUBSCRIPTION_RULES[userType]?.free;
};