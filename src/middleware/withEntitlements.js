import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";



export const withEntitlements = (resourceKey) => (req, res, next) => {
  const plan = req.user?.subscriptionPlan || "free";

  const rules =
    SUBSCRIPTION_RULES?.[resourceKey]?.[plan] ||
    SUBSCRIPTION_RULES?.[resourceKey]?.free;

  req.plan = plan;
  req.rules = rules;

  next();
};
