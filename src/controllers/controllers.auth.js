import crypto from "crypto";
import User from "../models/model.user.js";
import Artist from "../models/model.artist.js";
import Venue from "../models/model.venue.js";
import Journalist from "../models/model.journalist.js";
import { sendResetPasswordEmail, sendVerificationEmail } from "../utils/emailService.js";
import { generateToken } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import Photographer from "../models/model.photographer.js";
import { STATE_CITY_MAPPING } from "../utils/constants.js";
import Studio from "../models/model.studio.js";

/* ========================================================
   REGISTER - UPDATED WITH STATE & CITY
======================================================== */
export const register = asyncHandler(async (req, res, next) => {
  const {
    username,
    email,
    password,
    userType,
    genre,
    state,
    city,
    plan,
  } = req.body;

  let subscriptionPlan = "free";
  let subscriptionStatus = "none";

  if (["artist", "venue", "photographer", "studio"].includes(userType)) {
    if (plan === "pro") {
      subscriptionPlan = "pro";
      subscriptionStatus = "active";
    }
  }

  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    return next(new ErrorResponse("User with this email or username already exists", 400));
  }

  // Validate state-city combination for non-fan users
  if (["artist", "venue", "journalist", "photographer", "studio"].includes(userType)) {
    if (!state || !city) {
      return next(new ErrorResponse("State and city are required for this user type", 400));
    }

    // Validate state
    const validStates = Object.keys(STATE_CITY_MAPPING);
    if (!validStates.includes(state)) {
      return next(new ErrorResponse(`Invalid state. Must be one of: ${validStates.join(", ")}`, 400));
    }

    // Validate city for the state
    const stateCities = STATE_CITY_MAPPING[state] || [];
    const cityLower = city.toLowerCase();

    if (!stateCities.includes(cityLower)) {
      return next(new ErrorResponse(
        `City "${city}" is not valid for state "${state}". Valid cities: ${stateCities.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}`,
        400
      ));
    }
  }

  // Create user with state and city
  const user = await User.create({
    username,
    email,
    password,
    userType,
    genre: genre?.toLowerCase(),
    state: state || null,
    city: city ? city.toLowerCase() : null,
    subscriptionPlan,
    subscriptionStatus,
    verificationRequested: userType !== "fan",
  });

  // Create corresponding profile based on user type
  if (userType === "artist") {
    await Artist.create({
      user: user._id,
      name: username,
      state: state || "Alabama",
      city: city ? city.toLowerCase() : "mobile",
      genre: genre?.toLowerCase(),
      biography: "",
      photos: [],
      mp3Files: [],
      isActive: false,
    });
  }

  if (userType === "venue") {
    await Venue.create({
      user: user._id,
      venueName: username,
      state: state || "Alabama",
      city: city ? city.toLowerCase() : "mobile",
      address: "",
      seatingCapacity: 0,
      biography: "",
      openHours: "",
      openDays: "",
      photos: [],
      isActive: false,
      colorCode: null,
    });
  }

  if (userType === "journalist") {
    await Journalist.create({
      user: user._id,
      fullName: username,
      state: state || null,
      cities: city ? [city.toLowerCase()] : [],
      bio: "",
      profilePhoto: null,
      areasOfCoverage: [],
      isActive: false,
      isVerified: false,
    });
  }

  if (userType === "photographer") {
    await Photographer.create({
      user: user._id,
      name: username,
      state: state || "Alabama",
      city: city ? city.toLowerCase() : "mobile",
      biography: "",
      services: [],
      photos: [],
      videos: [],
      isActive: false,
    });
  }

  // ========== ADD STUDIO REGISTRATION ==========
  if (userType === "studio") {
    await Studio.create({
      user: user._id,
      name: username,
      state: state || "Alabama",
      city: city ? city.toLowerCase() : "mobile",
      biography: "",
      services: [],
      photos: [],
      audioFile: null,
      isActive: true,
      isVerified: false,
      isFeatured: false,
    });
  }

  // Send verification email for non-fan users
  if (userType !== "fan") {
    await sendVerificationEmail(user.email, userType);
  }

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: "Registration successful!",
    data: {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        state: user.state,
        city: user.city,
        subscriptionPlan,
        genre: user.genre,
      },
    },
  });
});

/* ========================================================
   LOGIN
======================================================== */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Find user - don't include password field initially
  const user = await User.findOne({ email });

  // User not found case
  if (!user) {
    return next(
      new ErrorResponse("Invalid email or password", 401, {
        details: [
          {
            field: "email",
            message: "No account found with this email address"
          }
        ]
      })
    );
  }

  // Now get user with password for verification
  const userWithPassword = await User.findOne({ email }).select("+password");

  // Check if user is active
  if (user.userType !== "fan" && !user.isActive) {
    return next(
      new ErrorResponse("Account deactivated", 403, {
        details: [
          {
            field: "email",
            message: "Your account has been deactivated by administrator (Please check your mail)"
          }
        ]
      })
    );
  }

  // Require admin verification for specific user types
  const requiresVerification = ["artist", "venue", "journalist"].includes(user.userType);
  if (requiresVerification && !user.isVerified) {
    return next(
      new ErrorResponse("Account pending verification", 403, {
        details: [
          {
            field: "email",
            message: "Your account is pending admin verification"
          }
        ]
      })
    );
  }

  // Check password
  const isMatch = await userWithPassword.matchPassword(password);
  if (!isMatch) {
    return next(
      new ErrorResponse("Invalid email or password", 401, {
        details: [
          {
            field: "password",
            message: "The password you entered is incorrect"
          }
        ]
      })
    );
  }

  // Generate token
  const token = generateToken(user._id);

  // Prepare user data for response
  const userData = {
    id: user._id,
    username: user.username,
    email: user.email,
    userType: user.userType,
    state: user.state,
    city: user.city,
    genre: user.genre,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionStatus: user.subscriptionStatus,
    isVerified: user.isVerified,
    isActive: user.isActive,
    trialEndsAt: user.trialEndsAt,
    trialUsed: user.trialUsed,
  };

  res.status(200).json({
    success: true,
    message: "Login successful! Redirecting...",
    data: {
      token,
      user: userData,
    },
  });
});

/*========================================================
   GET CURRENT USER - UPDATED
======================================================== */
export const getMe = asyncHandler(async (req, res, next) => {
  if (!req.user?.id) {
    return next(new ErrorResponse("Unauthorized access. Please log in.", 401));
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found or account deleted.", 404));
  }

  // Prepare user data with state and city
  const userData = {
    id: user._id,
    username: user.username,
    email: user.email,
    userType: user.userType,
    genre: user.genre,
    state: user.state,
    city: user.city,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionStatus: user.subscriptionStatus,
    isVerified: user.isVerified,
    isActive: user.isActive,
    trialEndsAt: user.trialEndsAt,
    trialUsed: user.trialUsed,
    stripeAccountId: user.stripeAccountId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  res.status(200).json({
    success: true,
    message: "User profile fetched successfully",
    data: {
      user: userData,
    },
  });
});

/* ========================================================
   FORGOT PASSWORD
======================================================== */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return next(new ErrorResponse("No account found with this email", 404));
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  await sendResetPasswordEmail(user.email, resetUrl);

  res.status(200).json({
    success: true,
    message: "Password reset link sent to your email!",
  });
});

/* ========================================================
   RESET PASSWORD
======================================================== */
export const resetPassword = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorResponse("Invalid or expired reset token", 400));
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successful. You can now log in.",
  });
});

/* ========================================================
   UPDATE USER PROFILE (Optional - if needed)
======================================================== */
export const updateProfile = asyncHandler(async (req, res, next) => {
  const { state, city, genre } = req.body;

  // Find user
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  // Validate state-city if provided
  if (state || city) {
    const updateState = state || user.state;
    const updateCity = city || user.city;

    if (updateState && updateCity) {
      const stateCities = STATE_CITY_MAPPING[updateState] || [];
      if (!stateCities.includes(updateCity.toLowerCase())) {
        return next(new ErrorResponse(
          `City "${updateCity}" is not valid for state "${updateState}"`,
          400
        ));
      }
    }

    // Update state and city
    if (state) user.state = state;
    if (city) user.city = city.toLowerCase();
  }

  // Update genre if provided and user is artist
  if (genre && user.userType === "artist") {
    user.genre = genre.toLowerCase();
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        state: user.state,
        city: user.city,
        genre: user.genre,
      },
    },
  });
});

/* ========================================================
   GET USER BY TYPE AND LOCATION (For filtering)
======================================================== */
export const getUsersByLocation = asyncHandler(async (req, res, next) => {
  const { state, city, userType } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Build query
  const query = { isActive: true, isVerified: true };

  if (state) query.state = state;
  if (city) query.city = city.toLowerCase();
  if (userType) query.userType = userType;

  const users = await User.find(query)
    .select("username email userType state city genre subscriptionPlan createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: {
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
      filters: {
        state,
        city,
        userType,
      },
    },
  });
});