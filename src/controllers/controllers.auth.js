import { validationResult } from "express-validator";
import { sendResetPasswordEmail, sendVerificationEmail } from "../utils/emailService.js";
import { generateToken } from "../utils/helpers.js";
import User from "../models/model.user.js";
import { formatValidationErrors } from "../utils/validationFormatter.js";
import Journalist from "../models/model.journalist.js";
import Venue from "../models/model.venue.js";
import Artist from './../models/model.artist.js';
import crypto from "crypto";


export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields",
        errors: formatValidationErrors(errors.array()),
      });
    }

    const { username, email, password, userType, genre, location } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or username already exists",
      });
    }

    // Create User
    const user = await User.create({
      username,
      email,
      password,
      userType,
      genre: genre?.toLowerCase(),
      location: location?.toLowerCase(),
      verificationRequested: userType !== "fan",
    });

    // Auto Create Profile Based on userType
    if (userType === "artist") {
      await Artist.create({
        user: user._id,
        name: user.username,
        city: user.location || "new orleans",
        genre: user.genre,
        biography: "",
        photos: [],
        mp3Files: [],
      });
    }

    if (userType === "venue") {
      await Venue.create({
        user: user._id,
        venueName: user.username,
        city: user.location || "new orleans",
        address: "",
        seatingCapacity: 10,
        openHours: "",
        openDays: "",
        photos: [],
      });
    }

    if (userType === "journalist") {
      await Journalist.create({
        user: user._id,
        fullName: user.username,
        bio: "",
        profilePhoto: null,
        areasOfCoverage: user.location ? [user.location] : [],
      });
    }

    // (Optional) Send verification email
    if (userType !== "fan") {
      await sendVerificationEmail(user.email, user.userType);
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Registration successful and profile created automatically!",
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          userType: user.userType,
          genre: user.genre,
          location: user.location,
        },
      },
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({
      success: false,
      message: "Something went wrong during registration.",
    });
  }
};


// Log-in 

export const login = async (req, res) => {
  try {
    // Handle express-validator errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields",
        errors: formatValidationErrors(errors.array()),
      });
    }

    // Extract data
    const { email, password } = req.body;

    // Find user and check password
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        errors: [
          {
            field: "email",
            message: "No account found with this email",
          },
        ],
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        errors: [
          {
            field: "password",
            message: "Incorrect password",
          },
        ],
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Successful response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    // Handle unknown server error
    res.status(500).json({
      success: false,
      message:
        "Something went wrong during login. Please try again later.",
    });
  }
};

export const getMe = async (req, res, next) => {
  try {

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
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("GetMe Error:", error);
    next(new ErrorResponse("Server error while fetching user profile.", 500));
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    // Generate token
    const resetToken = user.getResetPasswordToken();

    // Save hashed token in DB
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    // Send email
    await sendResetPasswordEmail(user.email, resetUrl);

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email!",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while sending reset link.",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash token again to match with DB
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user by token and check expiry
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resetting password.",
    });
  }
};
