import { validationResult } from "express-validator";
import Venue from "../models/model.venue.js";
import { cloudinary } from "../config/cloudinary.js";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create or Update Venue Profile

export const createOrUpdateProfile = async (req, res) => {
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
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
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
      if (!venue) {
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
    }

    res.status(200).json({
      success: true,
      message: "Venue profile saved successfully",
      data: { venue },
    });
  } catch (error) {
    console.error("Venue profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while saving venue profile",
    });
  }
};

export const getMyVenueProfile = async (req, res) => {
  try {
    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    console.error("Get my venue profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching venue profile",
    });
  }
};

// Update Venue Profile (PUT)

export const updateVenueProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
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

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue profile not found",
      });
    }

    // Update data
    venue.venueName = venueName || venue.venueName;
    venue.city = city || venue.city;
    venue.address = address || venue.address;
    venue.seatingCapacity = seatingCapacity || venue.seatingCapacity;
    venue.biography = biography || venue.biography;
    venue.openHours = openHours || venue.openHours;
    venue.openDays = openDays || venue.openDays;

    // Update photos (Cloudinary)
    if (req.files?.photos) {
      venue.photos = req.files.photos.map((file) => ({
        url: file.path,
        filename: file.filename,
      }));
    }

    await venue.save();

    res.status(200).json({
      success: true,
      message: "Venue profile updated successfully",
      data: { venue },
    });
  } catch (error) {
    console.error("Update venue error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating venue profile",
    });
  }
};

// Delete Venue Profile

export const deleteVenueProfile = async (req, res) => {
  try {
    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue profile not found",
      });
    }

    if (venue.photos?.length) {
      for (const photo of venue.photos) {
        try {
          await cloudinary.uploader.destroy(photo.filename);
        } catch (err) {
          console.warn(`Failed to delete Cloudinary image: ${photo.filename}`);
        }
      }
    }

    await venue.deleteOne();

    res.status(200).json({
      success: true,
      message: "Venue profile deleted successfully",
    });
  } catch (error) {
    console.error("Delete venue error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting venue profile",
    });
  }
};

// Get Venues by City (Filter)

export const getVenuesByCity = async (req, res) => {
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
    console.error("Get venues error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching venues",
    });
  }
};

//  Get Single Venue by ID

export const getVenue = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id).populate(
      "user",
      "username email"
    );

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { venue },
    });
  } catch (error) {
    console.error("Get venue error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching venue",
    });
  }
};

export const addShow = async (req, res) => {
  try {
    const { artist, date, time } = req.body;
    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    venue.shows.push({ artist, date, time });
    await venue.save();

    res.status(200).json({
      success: true,
      message: "Show added successfully",
      data: venue,
    });
  } catch (error) {
    console.error("Add show error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding show",
    });
  }
};

export const getCalendarByCity = async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) {
      return res
        .status(400)
        .json({ success: false, message: "City is required" });
    }

    const venues = await Venue.find({ city: city.toLowerCase() }).select(
      "venueName colorCode shows"
    );

    res.status(200).json({
      success: true,
      data: { venues },
    });
  } catch (error) {
    console.error("Calendar fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching calendar data",
    });
  }
};
