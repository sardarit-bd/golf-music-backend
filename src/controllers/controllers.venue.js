import { validationResult } from "express-validator";
import Venue from "../models/model.venue.js";
import { cloudinary } from "../config/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import Event from "../models/models.event.js";



//  CREATE or UPDATE Venue Profile

export const createOrUpdateProfile = async (req, res) => {
  try {

    // Process photos from Cloudinary
    const newPhotos = req.files
      ? req.files.map(file => ({
        url: file.path,
        filename: file.filename
      }))
      : [];

    let venues = await Venue.findOne({ user: req.user._id });

    // Merge old + new photos (max limit 5)
    const mergedPhotos = venues
      ? [...venues.photos, ...newPhotos].slice(0, 5)  // keep up to 5
      : newPhotos.slice(0, 5);

    const venueData = {
      venueName: req.body.venueName,
      city: req.body.city,
      address: req.body.address,
      seatingCapacity: parseInt(req.body.seatingCapacity),
      biography: req.body.biography,
      openHours: req.body.openHours,
      openDays: req.body.openDays,
      photos: mergedPhotos,
      updatedAt: Date.now()
    };

    // Find existing venue for this user
    let venue = await Venue.findOne({ user: req.user._id });

    if (venue) {
      Object.keys(venueData).forEach(key => {
        venue[key] = venueData[key];
      });
      await venue.save();
    } else {
      venue = new Venue({
        user: req.user._id,
        ...venueData
      });
      await venue.save();
    }

    // Fetch the updated venue to return
    const updatedVenue = await Venue.findOne({ user: req.user._id });

    res.status(200).json({
      success: true,
      message: "Venue profile saved successfully",
      data: { venue: updatedVenue }
    });

  } catch (error) {
    console.error('VENUE PROFILE ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


//  GET My Venue Profile

export const getMyVenueProfile = asyncHandler(async (req, res, next) => {
  const venue = await Venue.findOne({ user: req.user.id });

  if (!venue) {
    throw new ErrorResponse("Venue profile not found", 404);
  }

  res.status(200).json({
    success: true,
    data: { venue },
  });
});


//  UPDATE Venue Profile (PUT)

export const updateVenueProfile = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return next(new ErrorResponse("Validation failed", 400, { details: formatted }));
  }

  const { venueName, city, address, seatingCapacity, biography, openHours, openDays } = req.body;

  const updateData = {
    venueName,
    city,
    address,
    seatingCapacity,
    biography,
    openHours,
    openDays,
    photos: req.files?.photos
      ? req.files.photos.map((file) => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
      }))
      : undefined,
  };


  const venue = await Venue.findOneAndUpdate({ user: req.user.id }, updateData, {
    new: true,
    runValidators: true,
  });

  if (!venue) {
    return next(new ErrorResponse("Venue profile not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Venue profile updated successfully",
    data: { venue },
  });
});




//  DELETE Venue Profile

export const deleteVenueProfile = asyncHandler(async (req, res, next) => {
  const venue = await Venue.findOne({ user: req.user.id });

  if (!venue) {
    throw new ErrorResponse("Venue profile not found", 404);
  }

  if (venue.photos?.length) {
    for (const p of venue.photos) {
      try {
        await cloudinary.uploader.destroy(p.filename);
      } catch (err) {
        console.warn("Failed to delete old image:", p.filename);
      }
    }
  }

  await venue.deleteOne();

  res.status(200).json({
    success: true,
    message: "Venue profile deleted successfully",
  });
});


//  GET Venues by City (Filter)

export const getVenuesByCity = asyncHandler(async (req, res, next) => {
  const { city } = req.query;
  const query = { isActive: true };

  if (city && city !== "all") {
    query.city = city;
  }

  const venues = await Venue.find(query)
    .populate("user", "username email")
    .sort({ venueName: 1 });

  res.status(200).json({
    success: true,
    data: { venues },
  });
});


//  GET Single Venue by ID

export const getVenue = asyncHandler(async (req, res, next) => {
  const venue = await Venue.findById(req.params.id).populate("user", "username email");

  if (!venue) {
    throw new ErrorResponse("Venue not found", 404);
  }

  res.status(200).json({
    success: true,
    data: { venue },
  });
});


//  ADD Show to Venue

export const addShow = asyncHandler(async (req, res, next) => {
  const { artist, date, time } = req.body;

  // Find venue by user
  const venue = await Venue.findOne({ user: req.user.id });

  if (!venue) {
    throw new ErrorResponse("Venue not found", 404);
  }

  // IMAGE HANDLING
  const imageData = req.file
    ? { url: req.file.path, filename: req.file.filename }
    : null;

  // COLORS
  const venueColors = [
    "#0000FF", "#008000", "#FF0000", "#800080",
    "#FFA500", "#FFFF00", "#FFC0CB", "#A52A2A",
    "#FFFFFF", "#000000"
  ];

  const colorIndex = (venue.verifiedOrder - 1) % venueColors.length;
  const assignedColor = venueColors[colorIndex];

  const inputDate = new Date(date);
  const utcDate = new Date(Date.UTC(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    inputDate.getDate()
  ));

  // CREATE EVENT
  const event = await Event.create({
    artistBandName: artist,
    time,
    date: utcDate,
    image: imageData,
    venue: venue._id,
    city: venue.city,
    color: assignedColor,
  });

  // SAVE SHOW INSIDE VENUE (optional)
  venue.shows.push({ artist, date: utcDate, time });
  await venue.save();

  res.status(200).json({
    success: true,
    message: "Show added with image & event created",
    data: { venue, event },
  });
});




//  GET Calendar by City

export const getCalendarByCity = asyncHandler(async (req, res, next) => {
  const { city } = req.query;
  if (!city) {
    throw new ErrorResponse("City is required", 400);
  }

  const venues = await Venue.find({ city: city.toLowerCase() }).select(
    "venueName colorCode shows"
  );

  res.status(200).json({
    success: true,
    data: { venues },
  });
});



//  GET Venues for Admin

export const getVenuesForAdmin = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, search = "", status = "all" } = req.query;

  let query = {};

  // Search filter
  if (search) {
    query.$or = [
      { venueName: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } }
    ];
  }

  // Status filter
  if (status !== "all") {
    query.isActive = status === "active";
  }

  const venues = await Venue.find(query)
    .populate("user", "username email")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Venue.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      venues,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
});


//  UPDATE Venue by Admin

export const updateVenueByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const {
    venueName,
    city,
    address,
    seatingCapacity,
    biography,
    openHours,
    openDays,
    isActive
  } = req.body;

  const venueColors = [
    "#0000FF", "#008000", "#FF0000", "#800080",
    "#FFA500", "#FFFF00", "#FFC0CB", "#A52A2A",
    "#FFFFFF", "#000000"
  ];

  let venue = await Venue.findById(id);
  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  // Auto color assign only when verifying FIRST time
  if (isActive === true && venue.verifiedOrder === 0) {

    const verifiedCount = await Venue.countDocuments({
      isActive: true,
      city: venue.city,
      verifiedOrder: { $gt: 0 }
    });

    venue.verifiedOrder = verifiedCount + 1;

    const colorIndex = (venue.verifiedOrder - 1) % venueColors.length;
    venue.colorCode = venueColors[colorIndex];
  }

  // Apply regular updates
  if (venueName) venue.venueName = venueName;
  if (city) venue.city = city;
  if (address) venue.address = address;
  if (seatingCapacity) venue.seatingCapacity = seatingCapacity;
  if (biography) venue.biography = biography;
  if (openHours) venue.openHours = openHours;
  if (openDays) venue.openDays = openDays;

  if (isActive !== undefined) venue.isActive = isActive;

  venue.updatedAt = Date.now();
  await venue.save();

  res.status(200).json({
    success: true,
    message: "Venue verified & updated successfully",
    data: { venue }
  });
});




//  DELETE Venue by Admin

export const deleteVenueByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const venue = await Venue.findById(id);

  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  // Delete photos from Cloudinary
  if (venue.photos?.length) {
    for (const photo of venue.photos) {
      try {
        await cloudinary.uploader.destroy(photo.filename);
      } catch (err) {
        console.warn("Failed to delete image from Cloudinary:", photo.filename);
      }
    }
  }

  await venue.deleteOne();

  res.status(200).json({
    success: true,
    message: "Venue profile deleted successfully",
  });
});