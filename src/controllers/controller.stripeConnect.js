import { stripe } from "../config/stripe.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import User from "../models/model.user.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * CHECK STRIPE CONNECT STATUS
 * GET /api/stripe/connect/status
 */
export const getStripeConnectStatus = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  let stripeAccount = null;
  let requirements = null;

  
  if (user.stripeAccountId) {
    try {
      stripeAccount = await stripe.accounts.retrieve(user.stripeAccountId);
      
      requirements = {
        currently_due: stripeAccount.requirements?.currently_due || [],
        eventually_due: stripeAccount.requirements?.eventually_due || [],
        past_due: stripeAccount.requirements?.past_due || [],
        disabled_reason: stripeAccount.requirements?.disabled_reason || null
      };

      
      let accountStatus = 'not_connected';
      
      if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
        accountStatus = 'active';
      } else if (stripeAccount.requirements?.disabled_reason) {
        accountStatus = 'restricted';
      } else if (stripeAccount.details_submitted) {
        accountStatus = 'pending';
      }

      
      if (user.stripeAccountStatus !== accountStatus) {
        user.stripeAccountStatus = accountStatus;
        await user.save();
      }
      
    } catch (error) {
      console.error("❌ Error fetching Stripe account:", error.message);
      if (error.code === 'resource_missing') {
        user.stripeAccountId = null;
        user.stripeAccountStatus = 'not_connected';
        await user.save();
      }
    }
  }

  // ✅ FIX: Properly check if user can sell in market
  const canSellInMarket = () => {
    const sellerTypes = ["artist", "venue", "photographer", "studio", "journalist", "fan"];
    return sellerTypes.includes(user.userType) && user.isVerified;
  };

  res.status(200).json({
    success: true,
    data: {
      isStripeConnected: user.stripeAccountId ? true : false,
      stripeAccountId: user.stripeAccountId || null,
      stripeAccountStatus: user.stripeAccountStatus || 'not_connected',
      stripeStatusMessage: user.stripeAccountStatus === 'active' ? 'Active' : 
                           user.stripeAccountStatus === 'pending' ? 'Pending Approval' : 'Not Connected',
      userType: user.userType,
      isVerified: user.isVerified,
      canSellInMarket: canSellInMarket(),
      canConnectStripe: ["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(user.userType),
      requirements: requirements,
      chargesEnabled: stripeAccount?.charges_enabled || false,
      payoutsEnabled: stripeAccount?.payouts_enabled || false,
      detailsSubmitted: stripeAccount?.details_submitted || false
    }
  });
});

/**
 * CREATE STRIPE CONNECT ACCOUNT
 * POST /api/stripe/connect/onboard
 */
export const createStripeConnectAccount = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  // Allowed user types for Stripe Connect
  const allowedUserTypes = ["artist", "venue", "photographer", "studio", "journalist", "fan"];
  
  if (!allowedUserTypes.includes(user.userType)) {
    return next(new ErrorResponse("You are not eligible to become a seller", 403));
  }

  // Check if user is verified
  if (!user.isVerified) {
    return next(new ErrorResponse("Please verify your email first", 403));
  }

  // Already connected and active
  if (user.stripeAccountId && user.stripeAccountStatus === 'active') {
    return res.status(200).json({
      success: true,
      message: "Your Stripe account is already connected and active",
      data: {
        isStripeConnected: true,
        stripeAccountStatus: 'active'
      }
    });
  }

  // If account exists but not active, try to retrieve from Stripe
  if (user.stripeAccountId) {
    try {
      const existingAccount = await stripe.accounts.retrieve(user.stripeAccountId);
      
      // Check if account is fully onboarded
      if (existingAccount.charges_enabled && existingAccount.payouts_enabled) {
        user.stripeAccountStatus = 'active';
        await user.save();
        
        return res.status(200).json({
          success: true,
          message: "Your Stripe account is now active",
          data: {
            isStripeConnected: true,
            stripeAccountStatus: 'active'
          }
        });
      }
      
      // Create new onboarding link for existing account
      const accountLink = await stripe.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: `${process.env.CLIENT_URL}/stripe/refresh?account_id=${user.stripeAccountId}`,
        return_url: `${process.env.CLIENT_URL}/stripe/success?account_id=${user.stripeAccountId}`,
        type: "account_onboarding",
      });

      user.stripeAccountStatus = 'pending';
      await user.save();

      return res.json({
        success: true,
        url: accountLink.url,
        message: "Please complete your Stripe onboarding"
      });
      
    } catch (error) {
      // If account doesn't exist in Stripe, clean local record
      if (error.code === 'resource_missing') {
        user.stripeAccountId = null;
        user.stripeAccountStatus = 'not_connected';
        await user.save();
      } else {
        throw error;
      }
    }
  }

  // ✅ FIX: Better business profile based on user type
  const getBusinessProfile = () => {
    switch(user.userType) {
      case 'photographer':
        return {
          mcc: '7333', // Commercial Photography
          product_description: 'Photography services and digital photo sales'
        };
      case 'artist':
        return {
          mcc: '5735', // Record Stores
          product_description: 'Music and merchandise sales'
        };
      case 'venue':
        return {
          mcc: '7922', // Theatrical Producers
          product_description: 'Event tickets and venue bookings'
        };
      default:
        return {
          mcc: '5734', // Computer Software Stores
          product_description: 'Digital goods and services'
        };
    }
  };

  const businessProfile = getBusinessProfile();

  // Create new Stripe Connect account
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    business_profile: {
      url: user.website || `${process.env.CLIENT_URL}/profile/${user.username}`,
      mcc: businessProfile.mcc,
      product_description: businessProfile.product_description,
    },
    metadata: {
      userId: user._id.toString(),
      username: user.username,
      userType: user.userType,
      email: user.email
    },
  });

  // Save Stripe account ID
  user.stripeAccountId = account.id;
  user.stripeAccountStatus = 'pending';
  await user.save();

  // Create account onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.CLIENT_URL}/stripe/refresh?account_id=${account.id}`,
    return_url: `${process.env.CLIENT_URL}/stripe/success?account_id=${account.id}`,
    type: "account_onboarding",
  });

  res.status(201).json({
    success: true,
    url: accountLink.url,
    message: "Stripe Connect account created successfully. Please complete onboarding.",
    data: {
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending'
    }
  });
});

/**
 * CREATE STRIPE DASHBOARD LINK
 * GET /api/stripe/connect/dashboard
 */
export const createStripeDashboardLink = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  if (!user.stripeAccountId) {
    return next(new ErrorResponse("No Stripe account connected", 400));
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(user.stripeAccountId);
    
    res.status(200).json({
      success: true,
      url: loginLink.url,
      message: "Redirecting to Stripe Dashboard"
    });
    
  } catch (error) {
    console.error("❌ Error creating Stripe dashboard link:", error.message);
    
    // If account is not fully onboarded
    if (error.code === 'account_onboarding_not_completed') {
      // Create new onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: `${process.env.CLIENT_URL}/stripe/refresh?account_id=${user.stripeAccountId}`,
        return_url: `${process.env.CLIENT_URL}/stripe/success?account_id=${user.stripeAccountId}`,
        type: "account_onboarding",
      });
      
      user.stripeAccountStatus = 'pending';
      await user.save();
      
      return res.status(200).json({
        success: true,
        url: accountLink.url,
        message: "Please complete your Stripe onboarding first",
        requiresOnboarding: true
      });
    }
    
    return next(new ErrorResponse("Failed to access Stripe dashboard", 500));
  }
});

/**
 * REFRESH STRIPE ONBOARDING
 * GET /api/stripe/connect/refresh
 */
export const refreshStripeOnboarding = asyncHandler(async (req, res, next) => {
  const { account_id } = req.query;
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  if (!account_id || user.stripeAccountId !== account_id) {
    return next(new ErrorResponse("Invalid account ID", 400));
  }

  // Create new onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account_id,
    refresh_url: `${process.env.CLIENT_URL}/stripe/refresh?account_id=${account_id}`,
    return_url: `${process.env.CLIENT_URL}/stripe/success?account_id=${account_id}`,
    type: "account_onboarding",
  });

  res.status(200).json({
    success: true,
    url: accountLink.url,
    message: "Please complete your Stripe onboarding"
  });
});

/**
 * HANDLE STRIPE ONBOARDING SUCCESS
 * GET /api/stripe/connect/success
 */
export const handleStripeOnboardingSuccess = asyncHandler(async (req, res, next) => {
  const { account_id } = req.query;
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  if (!account_id || user.stripeAccountId !== account_id) {
    return next(new ErrorResponse("Invalid account ID", 400));
  }

  // Retrieve account to check status
  const account = await stripe.accounts.retrieve(account_id);
  
  // Update user status
  if (account.charges_enabled && account.payouts_enabled) {
    user.stripeAccountStatus = 'active';
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: "Stripe onboarding completed successfully!",
      data: {
        isStripeConnected: true,
        stripeAccountStatus: 'active',
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled
      }
    });
  } else {
    user.stripeAccountStatus = 'pending';
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: "Stripe onboarding is in progress",
      data: {
        isStripeConnected: false,
        stripeAccountStatus: 'pending',
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled
      }
    });
  }
});

/**
 * DISCONNECT STRIPE ACCOUNT
 * POST /api/stripe/connect/disconnect
 */
export const disconnectStripeAccount = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  if (!user.stripeAccountId) {
    return next(new ErrorResponse("No Stripe account connected", 400));
  }

  try {
    // Optionally deactivate the account in Stripe
    // await stripe.accounts.update(user.stripeAccountId, {
    //   metadata: { status: 'disconnected' }
    // });
    
    // Clear local Stripe Connect data
    user.stripeAccountId = null;
    user.stripeAccountStatus = 'not_connected';
    await user.save();
    
    res.status(200).json({
      success: true,
      message: "Stripe account disconnected successfully"
    });
    
  } catch (error) {
    console.error("❌ Error disconnecting Stripe account:", error.message);
    
    // Still clear local data even if Stripe API fails
    user.stripeAccountId = null;
    user.stripeAccountStatus = 'not_connected';
    await user.save();
    
    res.status(200).json({
      success: true,
      message: "Stripe account disconnected locally"
    });
  }
});