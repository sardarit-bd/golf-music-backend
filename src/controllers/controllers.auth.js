import { validationResult } from "express-validator";
import { sendVerificationEmail } from "../utils/emailService.js";
import { generateToken } from "../utils/helpers.js";
import User from "../models/model.user.js";

export const register = async (req, res) => {
  try {
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

    // Create user data object
    const userData = {
      username,
      email,
      password,
      userType,
      verificationRequested: userType !== "fan",
    };

    // Add genre/location based on user type
    if (userType === "artist") {
      if (!genre) {
        return res.status(400).json({ 
          success: false,
          message: "Genre is required for artists" 
        });
      }
      userData.genre = genre;
    }

    if (userType === "venue" || userType === "journalist") {
      if (!location) {
        return res.status(400).json({ 
          success: false,
          message: "Location is required for venues and journalists" 
        });
      }
      userData.location = location;
    }



    const user = await User.create(userData);

    if (userType !== "fan") {
      try {
        await sendVerificationEmail(user.email, user.userType);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        await User.findByIdAndDelete(user._id);
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email. Please try again.",
        });
      }
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message:
        userType === "fan"
          ? "Registration successful"
          : "Registration successful. Please check your email for verification instructions.",
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          userType: user.userType,
          genre: user.genre,
          location: user.location,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

export const login = async (req, res) => {
  try {
    const errors = validationResult(req);


    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

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
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error(500).json({
      success: false,
      message: "Server error",
    });
  }
};
