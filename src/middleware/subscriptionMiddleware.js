import { SUBSCRIPTION_CONFIG } from "../config/SUBSCRIPTION_CONFIG.js";


export const subscriptionCheck = (req, res, next) => {
  const user = req.user;
  
  if (!SUBSCRIPTION_CONFIG.SYSTEM_WIDE.ENABLE_SUBSCRIPTIONS) {
    req.effectivePlan = "free";
    req.subscriptionRestricted = false;
    return next();
  }
  
  if (SUBSCRIPTION_CONFIG.SYSTEM_WIDE.FORCE_FREE_FOR_ALL) {
    req.effectivePlan = "free";
    req.subscriptionRestricted = false;
    return next();
  }
  
  // Normal subscription logic
  const userPlan = user.subscriptionPlan || SUBSCRIPTION_CONFIG.SYSTEM_WIDE.DEFAULT_PLAN;
  req.effectivePlan = userPlan;
  req.subscriptionRestricted = true;
  
  next();
};

export const featureCheck = (feature) => {
  return (req, res, next) => {
    const plan = req.effectivePlan || "free";
    const userType = req.user.userType;
    
    const rules = SUBSCRIPTION_RULES[userType]?.[plan] || SUBSCRIPTION_RULES[userType]?.free;
    
    if (!rules[feature]) {
      return next(new ErrorResponse(
        `This feature is not available for your current plan`,
        403
      ));
    }
    
    next();
  };
};