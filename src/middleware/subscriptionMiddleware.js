import { ErrorResponse } from "./errorHandler.js";
import { SUBSCRIPTION_CONFIG } from "../config/SUBSCRIPTION_CONFIG.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";

/**
 * Middleware to check subscription status and set effective plan
 */
export const subscriptionCheck = async (req, res, next) => {
  try {
    const user = req.user;
    
    // ✅ Check if billing is enabled
    if (!SUBSCRIPTION_CONFIG.BILLING.ENABLE_BILLING) {
      req.effectivePlan = "free";
      req.marketFeePercent = 0;
      req.subscriptionRestricted = false;
      return next();
    }
    
    // Get user's actual plan from database
    const userPlan = user?.subscriptionPlan || "free";
    const userStatus = user?.subscriptionStatus || "none";
    
    // ✅ For Pro plan, check if subscription is active
    if (userPlan === "pro") {
      const isActive = ["active", "trialing"].includes(userStatus);
      
      if (isActive) {
        req.effectivePlan = "pro";
        req.marketFeePercent = SUBSCRIPTION_CONFIG.BILLING.MARKETPLACE_FEE_PERCENT.pro; // 0%
      } else {
        // If Pro but not active, downgrade to free for this request
        req.effectivePlan = "free";
        req.marketFeePercent = SUBSCRIPTION_CONFIG.BILLING.MARKETPLACE_FEE_PERCENT.free; // 10%
        req.subscriptionWarning = "Your Pro subscription is not active. Using free plan limits.";
      }
    } else {
      // Free plan
      req.effectivePlan = "free";
      req.marketFeePercent = SUBSCRIPTION_CONFIG.BILLING.MARKETPLACE_FEE_PERCENT.free; // 10%
    }
    
    req.subscriptionRestricted = true;
    next();
    
  } catch (error) {
    console.error("Subscription check error:", error);
    next(error);
  }
};

/**
 * Middleware to check if user has access to a specific feature
 * @param {string} feature - Feature name to check
 */
export const featureCheck = (feature) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const plan = req.effectivePlan || "free";
      const userType = user.userType;
      
      // Get rules for this user type and plan
      const rules = SUBSCRIPTION_RULES[userType]?.[plan] || SUBSCRIPTION_RULES[userType]?.free;
      
      // Check if feature exists and is enabled
      if (!rules || rules[feature] !== true) {
        return next(new ErrorResponse(
          `Feature "${feature}" is not available on your ${plan} plan. Please upgrade to Pro.`,
          403
        ));
      }
      
      next();
    } catch (error) {
      console.error("Feature check error:", error);
      next(error);
    }
  };
};

/**
 * Middleware to check if user can create market item
 * Different logic for free vs pro users
 */
export const canCreateMarketItem = async (req, res, next) => {
  try {
    const user = req.user;
    const plan = req.effectivePlan || "free";
    
    // Check if user is verified
    if (!user.isVerified) {
      return next(new ErrorResponse("Please verify your email first", 403));
    }
    
    // Check if user type is allowed to sell
    const allowedSellerTypes = ["artist", "venue", "photographer", "studio", "journalist", "fan"];
    if (!allowedSellerTypes.includes(user.userType)) {
      return next(new ErrorResponse("Your account type cannot create market listings", 403));
    }
    
    // For Pro users, check if subscription is active
    if (plan === "pro") {
      const isActive = ["active", "trialing"].includes(user.subscriptionStatus);
      if (!isActive) {
        return next(new ErrorResponse(
          "Your Pro subscription is not active. Please renew to create listings with 0% fee.",
          403
        ));
      }
    }
    
    next();
  } catch (error) {
    console.error("Market item creation check error:", error);
    next(error);
  }
};

/**
 * Middleware to add subscription info to response
 */
export const addSubscriptionInfo = (req, res, next) => {
  // Add subscription info to response locals for templates
  res.locals.subscription = {
    plan: req.effectivePlan || "free",
    feePercent: req.marketFeePercent || 10,
    warning: req.subscriptionWarning || null,
    canUpgrade: req.effectivePlan === "free" && 
                ["artist", "venue", "photographer", "studio"].includes(req.user?.userType)
  };
  
  next();
};