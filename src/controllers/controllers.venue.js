import { validationResult } from "express-validator";
import Venue from "../models/model.venue.js";
import { cloudinary } from "../config/cloudinary.js";
import dotenv from "dotenv";
import { ErrorResponse } from "../middleware/errorHandler.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =====================================================
   CREATE or UPDATE Venue Profile
===================================================== */
export const createOrUpdateProfile = async (req, res, next) => {
  const colorMap = {
    1: "Blue",
    2: "Green",
    3: "Red",
    4: "Purple",
    5: "Orange",
    6: "Yellow",
    7: "Pink",
    8: "Brown",
    9: "White",
    10: "Black",
  };

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors.array());
      return next(
        new ErrorResponse("Validation failed", 400, { details: errors.array() })
      );
    }

    const {
      venueName,
      city,
      address,
      seatingCapacity,
      biography,
      openHours,
      openDays,
    } = req.body;

    let venue = await Venue.findOne({ user: req.user.id });

    // Upload images to Cloudinary (if any)
    const uploadedPhotos = req.files?.photos?.length
      ? await Promise.all(
        req.files.photos.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "gulf-music/venues",
          });
          return { url: result.secure_url, filename: result.public_id };
        })
      )
      : [];

    // === Update or Create ===
    if (venue) {
      venue = await Venue.findByIdAndUpdate(
        venue._id,
        {
          venueName,
          city,
          address,
          seatingCapacity,
          biography,
          openHours,
          openDays,
          photos: uploadedPhotos.length > 0 ? uploadedPhotos : venue.photos,
        },
        { new: true, runValidators: true }
      );
    } else {
      const count = await Venue.countDocuments({ city });
      const verifiedOrder = count + 1;
      const colorCode = colorMap[verifiedOrder] || "Gray";
      venue = await Venue.create({
        user: req.user.id,
        venueName,
        city,
        address,
        seatingCapacity,
        biography,
        openHours,
        openDays,
        verifiedOrder,
        colorCode,
        photos: uploadedPhotos,
      });
    }

    res.status(200).json({
      success: true,
      message: "Venue profile saved successfully",
      data: { venue },
    });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
   GET My Venue Profile
===================================================== */
export const getMyVenueProfile = async (req, res, next) => {
  try {
    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return next(new ErrorResponse("Venue profile not found", 404));
    }

    res.status(200).json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    next(error);
  }
};


  //  UPDATE Venue Profile (PUT)


export const updateVenueProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse("Validation failed", 400, { details: errors.array() })
      );
    }

    const {
      venueName,
      city,
      address,
      seatingCapacity,
      biography,
      openHours,
      openDays,
      removePhotos = [] 
    } = req.body;

    let venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return next(new ErrorResponse("Venue profile not found", 404));
    }

    // Update basic data
    venue.venueName = venueName || venue.venueName;
    venue.city = city || venue.city;
    venue.address = address || venue.address;
    venue.seatingCapacity = seatingCapacity || venue.seatingCapacity;
    venue.biography = biography || venue.biography;
    venue.openHours = openHours || venue.openHours;
    venue.openDays = openDays || venue.openDays;

    // Handle photo removal first
    if (removePhotos && removePhotos.length > 0) {
      const removePhotoIds = Array.isArray(removePhotos) ? removePhotos : [removePhotos];
      
      // Delete from Cloudinary
      for (const photoId of removePhotoIds) {
        const photoToRemove = venue.photos.find(p => p._id.toString() === photoId || p.filename === photoId);
        if (photoToRemove) {
          try {
            await cloudinary.uploader.destroy(photoToRemove.filename);
          } catch (err) {
            console.warn("Failed to delete image from Cloudinary:", photoToRemove.filename);
          }
        }
      }
      
      // Remove from venue photos array
      venue.photos = venue.photos.filter(p => 
        !removePhotoIds.includes(p._id?.toString()) && !removePhotoIds.includes(p.filename)
      );
    }

    // Handle new photo uploads
    if (req.files?.photos?.length) {
      console.log(`Uploading ${req.files.photos.length} new photos to Cloudinary...`);
      
      const uploadedPhotos = await Promise.all(
        req.files.photos.map(async (file) => {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "gulf-music/venues",
            });
            console.log(`Successfully uploaded: ${result.secure_url}`);
            return { 
              url: result.secure_url, 
              filename: result.public_id 
            };
          } catch (uploadError) {
            console.error("Cloudinary upload failed:", uploadError);
            throw uploadError;
          }
        })
      );

      // Add new photos to existing photos array
      venue.photos = [...(venue.photos || []), ...uploadedPhotos];
      console.log(`Total photos after upload: ${venue.photos.length}`);
    }

    // Ensure photos array exists
    venue.photos = venue.photos || [];

    // Save the venue with updated data
    await venue.save();

    console.log("Venue profile updated successfully with photos:", venue.photos.length);

    res.status(200).json({
      success: true,
      message: "Venue profile updated successfully",
      data: { venue },
    });
  } catch (error) {
    console.error("Update venue profile error:", error);
    next(error);
  }
};

/* =====================================================
   DELETE Venue Profile
===================================================== */
export const deleteVenueProfile = async (req, res, next) => {
  try {
    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return next(new ErrorResponse("Venue profile not found", 404));
    }

    // Delete photos from Cloudinary
    if (req.files?.photos?.length && venue.photos?.length) {
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
  } catch (error) {
    next(error);
  }
};

/* =====================================================
   GET Venues by City (Filter)
===================================================== */
export const getVenuesByCity = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

/* =====================================================
   GET Single Venue by ID
===================================================== */
export const getVenue = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id).populate(
      "user",
      "username email"
    );

    if (!venue) {
      return next(new ErrorResponse("Venue not found", 404));
    }

    res.status(200).json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
   ADD Show to Venue
===================================================== */
export const addShow = async (req, res, next) => {
  try {
    const { artist, date, time } = req.body;
    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return next(new ErrorResponse("Venue not found", 404));
    }

    venue.shows.push({ artist, date, time });
    await venue.save();

    res.status(200).json({
      success: true,
      message: "Show added successfully",
      data: venue,
    });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
   GET Calendar by City
===================================================== */
export const getCalendarByCity = async (req, res, next) => {
  try {
    const { city } = req.query;
    if (!city) {
      return next(new ErrorResponse("City is required", 400));
    }

    const venues = await Venue.find({ city: city.toLowerCase() }).select(
      "venueName colorCode shows"
    );

    res.status(200).json({
      success: true,
      data: { venues },
    });
  } catch (error) {
    next(error);
  }
};
