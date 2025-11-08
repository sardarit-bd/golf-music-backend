import { validationResult } from "express-validator";
import Journalist from "../models/model.journalist.js";
import User from "../models/model.user.js";
import News from "../models/model.news.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";


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

  const { bio, areasOfCoverage } = req.body;


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


  const user = await User.findById(req.user.id).select("username email location");
  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }


  let journalist = await Journalist.findOne({ user: req.user.id });

  const data = {
    fullName: user.username,
    bio,
    areasOfCoverage:
      parsedAreas.length > 0
        ? parsedAreas
        : journalist?.areasOfCoverage || [user.location],
    profilePhoto: req.file
      ? { url: req.file.path, filename: req.file.filename }
      : journalist?.profilePhoto || null,
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
      },
    },
  });
});


  //  UPDATE Journalist Profile (PUT)

export const updateJournalistProfile = asyncHandler(async (req, res, next) => {
  const { fullName, bio, areasOfCoverage } = req.body;

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

  const updateData = {
    fullName,
    bio,
    areasOfCoverage: parsedAreas,
    profilePhoto: req.file
      ? {
          url: `/uploads/${req.file.filename}`,
          filename: req.file.filename,
        }
      : undefined,
  };

  const journalist = await Journalist.findOneAndUpdate(
    { user: req.user.id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!journalist) {
    return next(new ErrorResponse("Journalist profile not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Journalist profile updated successfully",
    data: { journalist },
  });
});


  //  DELETE Journalist Profile

export const deleteJournalistProfile = asyncHandler(async (req, res, next) => {
  const journalist = await Journalist.findOne({ user: req.user.id });
  if (!journalist) {
    return next(new ErrorResponse("Journalist profile not found", 404));
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
    "username email userType isVerified"
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
    "username email userType isVerified"
  );

  if (!journalist) {
    return next(new ErrorResponse("Journalist not found", 404));
  }

  res.status(200).json({
    success: true,
    data: { journalist },
  });
});


  //  GET All Journalists (Public)

export const getAllJournalists = asyncHandler(async (req, res, next) => {
  const journalists = await Journalist.find({ isActive: true })
    .populate("user", "username email userType isVerified")
    .sort({ fullName: 1 });

  res.status(200).json({
    success: true,
    count: journalists.length,
    data: { journalists },
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
