export const checkTrialStatus = async (req, res, next) => {
  const user = req.user;

  if (
    user.subscriptionStatus === "trialing" &&
    user.trialEndsAt &&
    new Date() > new Date(user.trialEndsAt)
  ) {
    user.subscriptionStatus = "expired";
    user.subscriptionPlan = "free";
    user.trialEndsAt = null;
    await user.save();
  }

  next();
};
