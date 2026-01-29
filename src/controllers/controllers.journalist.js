import { validationResult } from "express-validator";
import Journalist from "../models/model.journalist.js";
import User from "../models/model.user.js";
import News from "../models/model.news.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cloudinary } from "../config/cloudinary.js";

// Helper function to get state from city
const getStateFromCity = (city) => {
  if (!city) return '';
  
  const cityLower = city.toLowerCase();
  
  // Map cities to states based on client requirement
  const stateMap = {
    // Louisiana cities
    'new orleans': 'Louisiana',
    'baton rouge': 'Louisiana',
    'lafayette': 'Louisiana',
    'shreveport': 'Louisiana',
    'lake charles': 'Louisiana',
    'monroe': 'Louisiana',
    
    // Mississippi cities
    'jackson': 'Mississippi',
    'biloxi': 'Mississippi',
    'gulfport': 'Mississippi',
    'oxford': 'Mississippi',
    'hattiesburg': 'Mississippi',
    
    // Alabama cities
    'birmingham': 'Alabama',
    'mobile': 'Alabama',
    'huntsville': 'Alabama',
    'tuscaloosa': 'Alabama',
    
    // Florida cities
    'tampa': 'Florida',
    'st. petersburg': 'Florida',
    'clearwater': 'Florida',
    'pensacola': 'Florida',
    'panama city': 'Florida',
    'fort myers': 'Florida',
  };
  
  return stateMap[cityLower] || '';
};

//  CREATE or UPDATE Journalist Profile

export const createOrUpdateProfile = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(
      new ErrorResponse("Validation failed", 400, { details: formattedErrors })
    );
  }

  const { fullName, bio, areasOfCoverage, city } = req.body;
  const normalizedCity = city?.toLowerCase();
  const state = getStateFromCity(normalizedCity);

  // Parse areasOfCoverage
  let parsedAreas = [];
  try {
    parsedAreas = areasOfCoverage ? JSON.parse(areasOfCoverage) : [];
  } catch (err) {
    return next(
      new ErrorResponse(
        "Invalid format for areasOfCoverage. Must be a valid JSON array.",
        400
      )
    );
  }

  const user = await User.findById(req.user.id).select("username email subscriptionPlan");
  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  let journalist = await Journalist.findOne({ user: req.user.id });

  // Handle profile photo removal/update
  let profilePhoto = journalist?.profilePhoto || null;
  
  if (req.body.removedPhoto && journalist?.profilePhoto?.publicId) {
    try {
      await cloudinary.uploader.destroy(journalist.profilePhoto.publicId);
    } catch (err) {
      console.log("Failed to delete old profile photo:", err);
    }
    profilePhoto = null;
  }

  if (req.file) {
    // Delete old photo if exists
    if (journalist?.profilePhoto?.publicId) {
      try {
        await cloudinary.uploader.destroy(journalist.profilePhoto.publicId);
      } catch (err) {
        console.log("Failed to delete old profile photo:", err);
      }
    }
    
    profilePhoto = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename.replace(/\.[^/.]+$/, "") // Remove extension for publicId
    };
  }

  const data = {
    fullName: fullName || user.username,
    bio,
    city: normalizedCity,
    state,
    areasOfCoverage: parsedAreas,
    profilePhoto,
    subscriptionPlan: user.subscriptionPlan,
    isActive: true,
  };

  if (journalist) {
    journalist = await Journalist.findByIdAndUpdate(journalist._id, data, {
      new: true,
      runValidators: true,
    });
  } else {
    journalist = await Journalist.create({
      user: req.user.id,
      ...data,
    });
  }

  res.status(200).json({
    success: true,
    message: "Journalist profile saved successfully",
    data: {
      journalist: {
        ...journalist.toObject(),
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
      },
    },
  });
});

//  UPDATE Journalist Profile (PUT)

export const updateJournalistProfile = asyncHandler(async (req, res, next) => {
  const { fullName, bio, areasOfCoverage, city } = req.body;
  const normalizedCity = city?.toLowerCase();
  const state = getStateFromCity(normalizedCity);

  let parsedAreas = undefined;
  if (areasOfCoverage) {
    try {
      parsedAreas = JSON.parse(areasOfCoverage);
    } catch (err) {
      return next(
        new ErrorResponse("Invalid format for areasOfCoverage. Must be valid JSON.", 400)
      );
    }
  }

  const journalist = await Journalist.findOne({ user: req.user.id });
  if (!journalist) {
    return next(new ErrorResponse("Journalist profile not found", 404));
  }

  // Handle profile photo removal/update
  let profilePhoto = journalist.profilePhoto;
  
  if (req.body.removedPhoto && journalist.profilePhoto?.publicId) {
    try {
      await cloudinary.uploader.destroy(journalist.profilePhoto.publicId);
    } catch (err) {
      console.log("Failed to delete profile photo:", err);
    }
    profilePhoto = null;
  }

  if (req.file) {
    // Delete old photo if exists
    if (journalist.profilePhoto?.publicId) {
      try {
        await cloudinary.uploader.destroy(journalist.profilePhoto.publicId);
      } catch (err) {
        console.log("Failed to delete old profile photo:", err);
      }
    }
    
    profilePhoto = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename.replace(/\.[^/.]+$/, "")
    };
  }

  const updateData = {
    fullName,
    bio,
    city: normalizedCity,
    state,
    areasOfCoverage: parsedAreas,
    profilePhoto,
  };

  const updatedJournalist = await Journalist.findByIdAndUpdate(
    journalist._id,
    updateData,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: "Journalist profile updated successfully",
    data: { journalist: updatedJournalist },
  });
});

//  DELETE Journalist Profile

export const deleteJournalistProfile = asyncHandler(async (req, res, next) => {
  const journalist = await Journalist.findOne({ user: req.user.id });
  if (!journalist) {
    return next(new ErrorResponse("Journalist profile not found", 404));
  }

  // Delete profile photo from Cloudinary
  if (journalist.profilePhoto?.publicId) {
    try {
      await cloudinary.uploader.destroy(journalist.profilePhoto.publicId);
    } catch (err) {
      console.log("Failed to delete profile photo:", err);
    }
  }

  await journalist.deleteOne();

  res.status(200).json({
    success: true,
    message: "Journalist profile deleted successfully",
  });
});

//  GET Logged-in Journalist Profile

export const getProfile = asyncHandler(async (req, res, next) => {
  const journalist = await Journalist.findOne({ user: req.user.id }).populate(
    "user",
    "username email userType subscriptionPlan isVerified"
  );

  if (!journalist) {
    return next(new ErrorResponse("Journalist profile not found", 404));
  }

  res.status(200).json({
    success: true,
    data: { journalist },
  });
});

//  GET Journalist by ID (Public)

export const getJournalist = asyncHandler(async (req, res, next) => {
  const journalist = await Journalist.findById(req.params.id).populate(
    "user",
    "username email userType subscriptionPlan isVerified"
  );

  if (!journalist) {
    return next(new ErrorResponse("Journalist not found", 404));
  }

  res.status(200).json({
    success: true,
    data: { journalist },
  });
});

//  GET All Journalists (Public) - with location filtering

export const getAllJournalists = asyncHandler(async (req, res, next) => {
  const { state, city, isVerified } = req.query;
  
  let query = { isActive: true };
  
  // State filter
  if (state && state !== "all") {
    query.state = state;
  }
  
  // City filter
  if (city && city !== "all") {
    query.city = city.toLowerCase();
  }
  
  // Verified filter
  if (isVerified === "true") {
    query.isVerified = true;
  } else if (isVerified === "false") {
    query.isVerified = false;
  }

  const journalists = await Journalist.find(query)
    .populate("user", "username email userType subscriptionPlan isVerified")
    .sort({ fullName: 1 });

  res.status(200).json({
    success: true,
    count: journalists.length,
    data: { journalists },
  });
});

//  GET Journalists by Location (for homepage dropdown)

export const getJournalistsByLocation = asyncHandler(async (req, res, next) => {
  const { state, city } = req.query;
  
  if (!state) {
    return next(new ErrorResponse("State parameter is required", 400));
  }

  let query = { 
    state: state,
    isActive: true,
    isVerified: true 
  };

  if (city && city !== "all") {
    query.city = city.toLowerCase();
  }

  const journalists = await Journalist.find(query)
    .populate("user", "username email subscriptionPlan")
    .sort({ fullName: 1 })
    .limit(50); // Limit for performance

  res.status(200).json({
    success: true,
    data: { 
      journalists,
      location: { state, city },
      count: journalists.length
    },
  });
});

//  GET News Articles by Journalist (Public)

export const getJournalistNews = asyncHandler(async (req, res, next) => {
  const news = await News.find({
    journalist: req.params.id,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .populate("journalist", "fullName");

  res.status(200).json({
    success: true,
    count: news.length,
    data: { news },
  });
});

//  VERIFY Journalist (Admin Only)

export const verifyJournalist = asyncHandler(async (req, res, next) => {
  const journalist = await Journalist.findByIdAndUpdate(
    req.params.id,
    {
      isVerified: true,
      verifiedAt: new Date(),
    },
    { new: true, runValidators: true }
  );

  if (!journalist) {
    return next(new ErrorResponse("Journalist not found", 404));
  }

  await User.findByIdAndUpdate(journalist.user, { isVerified: true });

  res.status(200).json({
    success: true,
    message: "Journalist verified successfully",
    data: { journalist },
  });
});

// Get journalists for admin dashboard
export const getJournalistsForAdmin = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    city = "",
    state = "all",
    plan = "all",
  } = req.query;

  // Build query
  let query = {};

  // Search filter
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { bio: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
    ];
  }

  // Status filter
  if (status !== "all") {
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
  }

  // City filter
  if (city) {
    query.city = city.toLowerCase();
  }

  // State filter
  if (state !== "all") {
    query.state = state;
  }

  // Plan filter
  if (plan !== "all") {
    query.subscriptionPlan = plan;
  }

  const skip = (Number(page) - 1) * Number(limit);

  // Get journalists with populated user info
  const journalists = await Journalist.find(query)
    .populate("user", "username email createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Get total count for pagination
  const total = await Journalist.countDocuments(query);

  // Calculate stats
  const verifiedCount = await Journalist.countDocuments({ isVerified: true });
  const unverifiedCount = await Journalist.countDocuments({ isVerified: false });
  const activeCount = await Journalist.countDocuments({ isActive: true });
  const inactiveCount = await Journalist.countDocuments({ isActive: false });

  // Get state-wise counts
  const stateCounts = {
    Louisiana: await Journalist.countDocuments({ state: 'Louisiana' }),
    Mississippi: await Journalist.countDocuments({ state: 'Mississippi' }),
    Alabama: await Journalist.countDocuments({ state: 'Alabama' }),
    Florida: await Journalist.countDocuments({ state: 'Florida' }),
  };

  res.status(200).json({
    success: true,
    data: {
      content: journalists,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
      },
      stats: {
        total,
        verified: verifiedCount,
        unverified: unverifiedCount,
        active: activeCount,
        inactive: inactiveCount,
        byState: stateCounts
      }
    },
  });
});