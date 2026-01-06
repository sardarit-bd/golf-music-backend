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


/* ========================================================
   REGISTER
======================================================== */
export const register = asyncHandler(async (req, res, next) => {
  const {
    username,
    email,
    password,
    userType,
    genre,
    location,
    plan,
  } = req.body;

  let subscriptionPlan = "free";
  let subscriptionStatus = "none";

  if (["artist", "venue", "photographer"].includes(userType)) {
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


  const user = await User.create({
    username,
    email,
    password,
    userType,
    genre: genre?.toLowerCase(),
    location: location?.toLowerCase(),
    subscriptionPlan,
    subscriptionStatus,
    verificationRequested: userType !== "fan",
  });

  if (userType === "artist") {
    await Artist.create({
      user: user._id,
      name: username,
      city: location?.toLowerCase() || "new orleans",
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
      city: location?.toLowerCase() || "new orleans",
      address: "",
      seatingCapacity: 0,
      biography: "",
      openHours: "",
      openDays: "",
      photos: [],
      isActive: false,
    });
  }

  if (userType === "journalist") {
    await Journalist.create({
      user: user._id,
      fullName: username,
      bio: "",
      profilePhoto: null,
      areasOfCoverage: location ? [location.toLowerCase()] : [],
      isActive: false,
      isVerified: false,
    });
  }

  if (userType === "photographer") {
    await Photographer.create({
      user: user._id,
      name: username,
      city: location?.toLowerCase() || "new orleans",
      biography: "",
      services: [],
      photos: [],
      videos: [],
      isActive: false,
    });
  }

  // Send verification email
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
        subscriptionPlan,
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

  // Check password - THIS IS THE MAIN FIX
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

  res.status(200).json({
    success: true,
    message: "Login successful! Redirecting...",
    data: {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    },
  });
});

/*========================================================
   GET CURRENT USER
======================================================== */
export const getMe = asyncHandler(async (req, res, next) => {
  if (!req.user?.id) {
    return next(new ErrorResponse("Unauthorized access. Please log in.", 401));
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found or account deleted.", 404));
  }

  res.status(200).json({
    success: true,
    message: "User profile fetched successfully",
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        genre: user.genre,
        location: user.location,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
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
