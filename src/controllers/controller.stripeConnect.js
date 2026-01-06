import { stripe } from "../config/stripe.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import User from "../models/model.user.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createStripeConnectAccount = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) return next(new ErrorResponse("User not found", 404));

  if (!["artist", "venue", "photographer"].includes(user.userType)) {
    return next(new ErrorResponse("Not allowed", 403));
  }

  // already connected
  if (user.stripeAccountId) {
    return res.json({ success: true, message: "Already connected" });
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: user.email,
    metadata: {
      userId: user._id.toString(),
    },
  });

  user.stripeAccountId = account.id;
  await user.save();

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.CLIENT_URL}/stripe/refresh`,
    return_url: `${process.env.CLIENT_URL}/stripe/success`,
    type: "account_onboarding",
  });

  res.json({
    success: true,
    url: accountLink.url,
  });
});
