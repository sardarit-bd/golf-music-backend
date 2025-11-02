import { validationResult } from "express-validator";
import { sendVerificationEmail } from "../utils/emailService.js";
import { generateToken } from "../utils/helpers.js";
import User from "../models/model.user.js";
import { formatValidationErrors } from "../utils/validationFormatter.js";

export const register = async (req, res) => {
  try {
    // Step 1: Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields",
        errors: formatValidationErrors(errors.array()),
      });
    }

    // Destructure body
    const { username, email, password, userType, genre, location } = req.body;

    // Duplicate check
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or username already exists",
        errors: [
          {
            field: existingUser.email === email ? "email" : "username",
            message:
              existingUser.email === email
                ? "This email is already registered"
                : "This username is already taken",
          },
        ],
      });
    }

    // Build user object
    const userData = {
      username,
      email,
      password,
      userType,
      verificationRequested: userType !== "fan",
    };

    // Conditional validations
    if (userType === "artist" && !genre) {
      return res.status(400).json({
        success: false,
        message: "Genre is required for artists",
        errors: [{ field: "genre", message: "Please select a genre" }],
      });
    }

    if (
      (userType === "venue" || userType === "journalist") &&
      !location
    ) {
      return res.status(400).json({
        success: false,
        message: "Location is required for venues and journalists",
        errors: [
          {
            field: "location",
            message: "Please select a valid location",
          },
        ],
      });
    }

    // Attach genre/location if provided
    if (genre) userData.genre = genre;
    if (location) userData.location = location;

    // Create user
    const user = await User.create(userData);

    // Send verification email (except for fan)
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

    // Generate JWT
    const token = generateToken(user._id);

    // Success response
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

    // Fallback server error response
    res.status(500).json({
      success: false,
      message: "Something went wrong during registration. Please try again later.",
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
