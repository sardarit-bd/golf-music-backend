import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";


export const resolveRules = (resourceKey, user) => {
  const plan = user?.subscriptionPlan || "free";
  const status = user?.subscriptionStatus || "none";

  const canUsePro = plan === "pro" && (status === "trialing" || status === "active");

  const effectivePlan = canUsePro ? "pro" : "free";

  const rules =
    SUBSCRIPTION_RULES?.[resourceKey]?.[effectivePlan] ||
    SUBSCRIPTION_RULES?.[resourceKey]?.free;

  return { effectivePlan, rules };
};
