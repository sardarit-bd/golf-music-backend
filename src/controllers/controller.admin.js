import { cloudinary } from "../config/cloudinary.js";
import { SUBSCRIPTION_CONFIG } from "../config/SUBSCRIPTION_CONFIG.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import Admin from "../models/model.admin.js";
import Artist from "../models/model.artist.js";
import Journalist from "../models/model.journalist.js";
import News from "../models/model.news.js";
import Photographer from "../models/model.photographer.js";
import Studio from "../models/model.studio.js";
import User from "../models/model.user.js";
import Venue from "../models/model.venue.js";
import Contact from "../models/models.contact.js";
import Event from "../models/models.event.js";
import { ColorAssigner } from "../utils/colorAssigner.js";

// Promote User To Admin
export const promoteUserToAdmin = async (req, res, next) => {
  try {
    const { id } = req.params; // user ID to promote
    const { role = "content_admin", permissions = [] } = req.body;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) return next(new ErrorResponse("User not found", 404));

    // Prevent duplicate admin
    const existingAdmin = await Admin.findOne({ user: id });
    if (existingAdmin) {
      return next(new ErrorResponse("User is already an admin", 400));
    }

    // Create admin record
    const admin = await Admin.create({
      user: id,
      fullName: user.username,
      role,
      permissions: permissions.length ? permissions : ["manage_users", "manage_content"]
    });

    // Update user role to 'admin'
    user.userType = "admin";
    await user.save();

    res.status(201).json({
      success: true,
      message: "User promoted to admin successfully",
      data: { admin }
    });
  } catch (error) {
    next(new ErrorResponse("Failed to promote user to admin", 500));
  }
};

// @desc    Get dashboard statistics
export const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalArtists,
      totalVenues,
      totalNews,
      totalEvents,
      pendingContacts,
      recentUsers,
      recentEvents,
    ] = await Promise.all([
      User.countDocuments(),
      Artist.countDocuments({ isActive: true }),
      Venue.countDocuments({ isActive: true }),
      News.countDocuments({ isActive: true }),
      Event.countDocuments({ isActive: true }),
      Contact.countDocuments({ isRead: false }),
      User.find().sort({ createdAt: -1 }).limit(5),
      Event.find({ isActive: true })
        // UPDATE: Include venue colorCode in population
        .populate("venue", "venueName city colorCode")
        .sort({ date: 1 })
        .limit(5),
    ]);

    const userStats = await User.aggregate([
      { $group: { _id: "$userType", count: { $sum: 1 } } },
    ]);

    // NEW: Get color statistics
    const colorStats = await Venue.aggregate([
      { $match: { colorCode: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$city",
          total: { $sum: 1 },
          colorsUsed: { $addToSet: "$colorCode" }
        }
      },
      {
        $project: {
          city: "$_id",
          total: 1,
          colorsUsedCount: { $size: "$colorsUsed" },
          _id: 0
        }
      }
    ]);

    const subscriptionStats = await User.aggregate([
      { $match: { subscriptionPlan: { $in: ["pro", "free"] } } },
      {
        $group: {
          _id: "$subscriptionPlan",
          count: { $sum: 1 },
          users: { $push: { username: "$username", email: "$email" } }
        }
      },
      {
        $project: {
          plan: "$_id",
          count: 1,
          sampleUsers: { $slice: ["$users", 3] },
          _id: 0
        }
      }
    ]);
    const cityStats = await Venue.aggregate([
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          verified: { $sum: { $cond: [{ $gt: ["$verifiedOrder", 0] }, 1, 0] } },
          withColor: { $sum: { $cond: [{ $ne: ["$colorCode", null] }, 1, 0] } }
        }
      },
      {
        $project: {
          city: {
            $toUpper: { $substrCP: ["$_id", 0, 1] }
          },
          count: 1,
          verified: 1,
          withColor: 1,
          percentageVerified: { $multiply: [{ $divide: ["$verified", "$count"] }, 100] },
          percentageWithColor: { $multiply: [{ $divide: ["$withColor", "$count"] }, 100] },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);
    const recentVenues = await Venue.find({})
      .populate("user", "username email subscriptionPlan")
      .select("venueName city colorCode verifiedOrder createdAt")
      .sort({ createdAt: -1 })
      .limit(5);
    const upcomingEventsByCity = await Event.aggregate([
      {
        $match: {
          isActive: true,
          date: { $gte: new Date() }
        }
      },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          events: {
            $push: {
              id: "$_id",
              title: "$artistBandName",
              date: "$date",
              venue: "$venue"
            }
          }
        }
      },
      {
        $lookup: {
          from: "venues",
          localField: "events.venue",
          foreignField: "_id",
          as: "venueDetails"
        }
      },
      {
        $project: {
          city: {
            $toUpper: { $substrCP: ["$_id", 0, 1] }
          },
          count: 1,
          upcomingEvents: { $slice: ["$events", 3] },
          venueColors: {
            $map: {
              input: "$venueDetails",
              as: "venue",
              in: "$$venue.colorCode"
            }
          },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);
    const formatCityName = (city) => {
      if (!city) return "Unknown";
      return city
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };
    const formattedRecentEvents = recentEvents.map(event => ({
      id: event._id,
      title: event.artistBandName,
      date: event.date,
      time: event.time,
      venue: event.venue?.venueName || "Unknown Venue",
      city: formatCityName(event.city),
      color: event.venue?.colorCode || "#000000",
      hasColor: !!event.venue?.colorCode
    }));
    const formattedRecentVenues = recentVenues.map(venue => ({
      id: venue._id,
      name: venue.venueName,
      city: formatCityName(venue.city),
      colorCode: venue.colorCode || "Not assigned",
      verified: venue.verifiedOrder > 0,
      subscriptionPlan: venue.user?.subscriptionPlan || "free",
      createdAt: venue.createdAt,
      hasColor: !!venue.colorCode
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalArtists,
          totalVenues,
          totalNews,
          totalEvents,
          pendingContacts,
          venuesWithColor: await Venue.countDocuments({ colorCode: { $exists: true, $ne: null } }),
          venuesWithoutColor: await Venue.countDocuments({
            $or: [
              { colorCode: { $exists: false } },
              { colorCode: null }
            ]
          }),
          colorCoverage: {
            withColor: await Venue.countDocuments({ colorCode: { $exists: true, $ne: null } }),
            withoutColor: await Venue.countDocuments({
              $or: [
                { colorCode: { $exists: false } },
                { colorCode: null }
              ]
            }),
            total: await Venue.countDocuments(),
            percentage: Math.round(
              (await Venue.countDocuments({ colorCode: { $exists: true, $ne: null } }) /
                await Venue.countDocuments()) * 100
            ) || 0
          }
        },
        userStats,
        subscriptionStats,
        colorStats: {
          totalVenuesWithColor: await Venue.countDocuments({ colorCode: { $exists: true, $ne: null } }),
          totalVenuesWithoutColor: await Venue.countDocuments({
            $or: [
              { colorCode: { $exists: false } },
              { colorCode: null }
            ]
          }),
          byCity: colorStats,
          coverageByCity: cityStats.map(city => ({
            city: formatCityName(city.city),
            totalVenues: city.count,
            verified: city.verified,
            withColor: city.withColor,
            colorCoveragePercentage: city.percentageWithColor.toFixed(1),
            verificationPercentage: city.percentageVerified.toFixed(1)
          }))
        },
        cityDistribution: cityStats.map(city => ({
          city: formatCityName(city.city),
          total: city.count,
          verified: city.verified,
          withColor: city.withColor,
          colorCoverage: Math.round(city.percentageWithColor) || 0
        })),
        recentUsers,
        recentEvents: formattedRecentEvents,
        recentVenues: formattedRecentVenues,
        upcomingEventsByCity,
        quickStats: {
          totalActiveEvents: await Event.countDocuments({
            isActive: true,
            date: { $gte: new Date() }
          }),
          totalVerifiedVenues: await Venue.countDocuments({ verifiedOrder: { $gt: 0 } }),
          totalProUsers: await User.countDocuments({ subscriptionPlan: "pro" }),
          totalUnreadContacts: pendingContacts,
          colorAssignmentRate: Math.round(
            (await Venue.countDocuments({ colorCode: { $exists: true, $ne: null } }) /
              await Venue.countDocuments()) * 100
          ) || 0
        }
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    next(new ErrorResponse("Failed to fetch dashboard stats", 500));
  }
};

// @desc    Get all users
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, userType, search, verified } = req.query;
    let query = {};

    if (userType && userType !== "all") query.userType = userType;
    if (verified !== undefined) query.isVerified = verified === "true";
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await User.countDocuments(query);

    const usersWithArtistUpdated = await Promise.all(
      users.map(async (user) => {
        if (user.userType === "artist") {
          const artist = await Artist.findOne({ user: user._id })
            .select("updatedAt")
            .lean();

          if (artist?.updatedAt) {
            user.updatedAt = artist.updatedAt;
          }
        }
        return user;
      })
    );

    res.status(200).json({
      success: true,
      data: {
        users: usersWithArtistUpdated,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error(error);
    next(new ErrorResponse("Failed to fetch users", 500));
  }
};

// @desc    Verify user
export const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, isActive: true, verificationRequested: false },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return next(new ErrorResponse("User not found", 404));

    if (user.userType === "artist") {
      await Artist.findOneAndUpdate({ user: user._id }, { isActive: true });
    }

    if (user.userType === "venue") {
      await Venue.findOneAndUpdate({ user: user._id }, { isActive: true });
    }

    if (user.userType === "journalist") {
      await Journalist.findOneAndUpdate({ user: user._id }, { isActive: true });
    }

    if (user.userType === "photographer") {
      await Photographer.findOneAndUpdate(
        { user: user._id },
        { isActive: true, isVerified: true }
      );
    }

    res.status(200).json({
      success: true,
      message: `${user.userType} verified successfully!`,
      data: { user },
    });
  } catch (error) {
    next(new ErrorResponse("Error verifying user", 500));
  }
};


// @desc    Delete user (soft delete)
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    // Delete related profile
    const modelMap = {
      artist: Artist,
      venue: Venue,
      journalist: Journalist,
      photographer: Photographer,
      studio: Studio,
      // fan: Fan
    };

    const ProfileModel = modelMap[user.userType];

    if (ProfileModel) {
      await ProfileModel.findOneAndDelete({ user: user._id });
    }

    // Delete admin record if exists
    await Admin.findOneAndDelete({ user: user._id });

    // Delete user
    await User.findByIdAndDelete(user._id);

    res.status(200).json({
      success: true,
      message: "User permanently deleted successfully",
    });

  } catch (error) {
    next(new ErrorResponse("Error deleting user", 500));
  }
};


// @desc    Get all content for moderation
export const getContentForModeration = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 10, status = "all", search = "" } = req.query;
    let model, populateField;

    // Model mapping
    switch (type) {
      case "artists":
        model = Artist;
        populateField = { path: "user", select: "username email" };
        break;
      case "venues":
        model = Venue;
        // UPDATE: Include colorCode in venue population
        populateField = { path: "user", select: "username email" };
        break;
      case "news":
        model = News;
        populateField = { path: "journalist", select: "username email" };
        break;
      case "events":
        model = Event;
        // UPDATE: Include venue colorCode in event population
        populateField = { path: "venue", select: "venueName city colorCode" };
        break;
      case "photographers":
        model = Photographer;
        populateField = { path: "user", select: "username email" };
        break;

      default:
        return next(new ErrorResponse("Invalid content type", 400));
    }

    let query = {};

    // Filter by active/inactive
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { genre: { $regex: search, $options: "i" } },
      ];
    }

    const total = await model.countDocuments(query);

    // UPDATE: For venues, also select colorCode
    let content;
    if (type === "venues") {
      content = await model.find(query)
        .populate(populateField)
        .select("+colorCode")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
    } else {
      content = await model.find(query)
        .populate(populateField)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
    }

    res.status(200).json({
      success: true,
      data: {
        content,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    next(new ErrorResponse("Failed to fetch moderation content", 500));
  }
};


// @desc    Toggle content status
export const toggleContentStatus = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { isActive } = req.body;

    const models = {
      artist: Artist,
      venue: Venue,
      news: News,
      event: Event,
      photographer: Photographer,
    };

    const model = models[type];
    if (!model) return next(new ErrorResponse("Invalid content type", 400));

    const content = await model.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!content) return next(new ErrorResponse("Content not found", 404));

    res.status(200).json({
      success: true,
      message: `Content ${isActive ? "activated" : "deactivated"} successfully`,
      data: { content },
    });
  } catch (error) {
    next(new ErrorResponse("Error toggling content status", 500));
  }
};

// @desc    Get contact messages
export const getContactMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, read } = req.query;
    let query = {};

    if (read !== undefined) query.isRead = read === "true";

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Contact.countDocuments(query);
    const unreadCount = await Contact.countDocuments({ isRead: false });

    res.status(200).json({
      success: true,
      data: {
        contacts,
        unreadCount,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    next(new ErrorResponse("Failed to fetch contact messages", 500));
  }
};

// @desc    Mark contact as read
export const markContactAsRead = async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true, runValidators: true }
    );

    if (!contact) return next(new ErrorResponse("Contact not found", 404));

    res.status(200).json({
      success: true,
      message: "Contact marked as read",
      data: { contact },
    });
  } catch (error) {
    next(new ErrorResponse("Error marking contact as read", 500));
  }
};


export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      userType,
      isVerified,
      subscriptionPlan,
      giveTrial
    } = req.body;


    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Basic fields update
    if (username) user.username = username;
    if (email) user.email = email.toLowerCase().trim();
    if (userType) user.userType = userType;
    if (typeof isVerified === "boolean") user.isVerified = isVerified;


    const proEligibleTypes = ["artist", "venue", "photographer"];

    if (subscriptionPlan) {
      if (subscriptionPlan === "pro") {
        if (!proEligibleTypes.includes(user.userType)) {
          return res.status(400).json({
            success: false,
            message: "Only artists, venues, and photographers can be Pro users.",
          });
        }

        user.subscriptionPlan = "pro";
        user.subscriptionStatus = "active";


        if (giveTrial) {
          const now = new Date();
          const trialEnds = new Date(
            now.getTime() + 30 * 24 * 60 * 60 * 1000
          );
          user.trialEndsAt = trialEnds;
        }
      } else if (subscriptionPlan === "free") {
        user.subscriptionPlan = "free";
        user.subscriptionStatus = "none";
        user.trialEndsAt = null;
        user.stripeSubscriptionId = undefined;
      }
    }

    user.updatedAt = Date.now();
    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Update user error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email or username already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating user",
    });
  }
};


// @desc    Delete contact
export const deleteContactMessage = async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return next(new ErrorResponse("Contact not found", 404));

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    next(new ErrorResponse("Error deleting contact", 500));
  }
};

// @desc    System settings
export const getSystemSettings = async (req, res, next) => {
  try {
    const settings = {
      siteName: "Gulf Coast Music",
      siteDescription: "Your premier platform for Gulf Coast music scene",
      maintenanceMode: false,
      allowRegistrations: true,
      maxFileSize: 10,
      allowedFileTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "audio/mpeg",
      ],
      emailNotifications: true,
    };

    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    next(new ErrorResponse("Failed to fetch system settings", 500));
  }
};


//  GET NEWS FOR ADMIN

export const getNewsForAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = "", status = "all", location = "" } = req.query;

    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } }
      ];
    }

    // Status filter
    if (status !== "all") {
      query.isActive = status === "active";
    }

    // Location filter
    if (location && location !== "all") {
      query.location = location.toLowerCase();
    }

    const news = await News.find(query)
      .populate("journalist", "fullName email username")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await News.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        news,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};


//  UPDATE NEWS BY ADMIN

//  UPDATE NEWS BY ADMIN - ফিক্সড ভার্সন
export const updateNewsByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { title, description, location, credit, isActive } = req.body;
    let news = await News.findById(id);
    if (!news) {
      return next(new ErrorResponse("News not found", 404));
    }

    // Prepare update data
    const updateData = {};

    if (title !== undefined && title !== '') updateData.title = title;
    if (description !== undefined && description !== '') updateData.description = description;
    if (location !== undefined && location !== '') updateData.location = location.toLowerCase();
    if (credit !== undefined && credit !== '') updateData.credit = credit;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

    // Handle removed photos
    if (req.body.removedPhotoUrls) {
      try {
        const removedUrls = JSON.parse(req.body.removedPhotoUrls);
        console.log("🗑️ Removed photos:", removedUrls);

        if (removedUrls.length > 0) {
          // Delete from Cloudinary
          for (const url of removedUrls) {
            const photoToDelete = news.photos.find(p => p.url === url);
            if (photoToDelete?.publicId) {
              try {
                await cloudinary.uploader.destroy(photoToDelete.publicId);
                console.log(`✅ Deleted: ${photoToDelete.publicId}`);
              } catch (err) {
                console.error(`❌ Failed to delete: ${photoToDelete.publicId}`, err);
              }
            }
          }

          // Keep only photos not removed
          updateData.photos = news.photos.filter(p => !removedUrls.includes(p.url));
        }
      } catch (err) {
        console.error("Error parsing removedPhotoUrls:", err);
      }
    }

    // Handle new photos upload
    let uploadedPhotos = [];
    if (req.files && req.files.length > 0) {
      console.log(`📸 Uploading ${req.files.length} new photos...`);

      uploadedPhotos = await Promise.all(
        req.files.map(async (file) => {
          // Check if file.path exists (for local upload) or file has Cloudinary info
          let url = file.path;
          let publicId = file.filename;

          // If using Cloudinary storage, file might already have Cloudinary info
          if (file.cloudinary) {
            url = file.cloudinary.secure_url || file.cloudinary.url;
            publicId = file.cloudinary.public_id;
          }

          return {
            url: url,
            filename: publicId,
            publicId: publicId
          };
        })
      );

      console.log(`✅ Uploaded ${uploadedPhotos.length} photos`);

      // Merge with existing photos
      if (updateData.photos) {
        updateData.photos = [...updateData.photos, ...uploadedPhotos];
      } else {
        updateData.photos = [...(news.photos || []), ...uploadedPhotos];
      }
    }

    // If no photos update, keep existing photos
    if (!updateData.photos) {
      updateData.photos = news.photos;
    }

    // Limit to max 5 photos
    if (updateData.photos && updateData.photos.length > 5) {
      updateData.photos = updateData.photos.slice(0, 5);
    }

    news = await News.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("journalist", "fullName email username");

    res.status(200).json({
      success: true,
      message: "News updated successfully",
      data: { news },
    });
  } catch (error) {
    console.error("❌ Update news error:", error);
    next(error);
  }
};

//  TOGGLE NEWS STATUS (ACTIVE/INACTIVE)

export const toggleNewsStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const news = await News.findById(id);
    if (!news) {
      return next(new ErrorResponse("News not found", 404));
    }

    news.isActive = !news.isActive;
    await news.save();

    res.status(200).json({
      success: true,
      message: `News ${news.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { news },
    });
  } catch (error) {
    next(error);
  }
};


//  DELETE NEWS BY ADMIN

export const deleteNewsByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const news = await News.findById(id);
    if (!news) {
      return next(new ErrorResponse("News not found", 404));
    }

    // Delete photos from Cloudinary
    if (news.photos?.length) {
      for (const photo of news.photos) {
        try {
          await cloudinary.uploader.destroy(photo.filename);
        } catch (err) {
          console.warn(`Failed to delete image: ${photo.filename}`);
        }
      }
    }

    await News.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "News permanently deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const getAdminProfile = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ user: req.user.id }).populate("user", "email username");

    if (!admin) return next(new ErrorResponse("Admin profile not found", 404));

    res.status(200).json({
      success: true,
      data: admin,
    });

  } catch (error) {
    next(new ErrorResponse("Failed to load admin profile", 500));
  }
};


export const updateAdminProfile = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ user: req.user.id });
    if (!admin) return next(new ErrorResponse("Admin profile not found", 404));

    const { fullName, bio, phone, email } = req.body;

    // --- UPDATE USER EMAIL ---
    const user = await User.findById(admin.user);

    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return next(new ErrorResponse("Email already in use", 400));
      }
      user.email = email.toLowerCase().trim();
      await user.save();
    }

    admin.fullName = fullName || admin.fullName;
    admin.bio = bio || admin.bio;
    admin.phone = phone || admin.phone;


    if (req.file) {
      if (admin.profilePhoto?.filename) {
        await cloudinary.uploader.destroy(admin.profilePhoto.filename);
      }

      admin.profilePhoto = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: "Admin profile updated successfully",
      data: {
        admin,
        user: { email: user.email }
      },
    });
  } catch (error) {
    next(error);
  }
};



// NEW: Get color management for admin
export const getColorManagement = async (req, res, next) => {
  try {
    const { city } = req.query;

    const validCities = ["new orleans", "biloxi", "mobile", "pensacola"];
    const selectedCity = city && validCities.includes(city.toLowerCase())
      ? city.toLowerCase()
      : "mobile";

    // Color palettes (same as in venue controller)
    const CITY_COLOR_PALETTES = {
      'new orleans': [
        "#FF6B6B", "#4ECDC4", "#FFD166", "#06D6A0", "#118AB2",
        "#073B4C", "#EF476F", "#7209B7", "#FF9E00", "#8338EC",
        "#3A86FF", "#FB5607", "#FF006E", "#8338EC", "#3A86FF",
        "#06D6A0", "#FFD166", "#EF476F", "#118AB2", "#7209B7"
      ],
      'biloxi': [
        "#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6",
        "#1ABC9C", "#D35400", "#C0392B", "#27AE60", "#8E44AD",
        "#16A085", "#E67E22", "#2980B9", "#D68910", "#A569BD",
        "#138D75", "#CA6F1E", "#7D3C98", "#117A65", "#B9770E"
      ],
      'mobile': [
        "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF",
        "#00FFFF", "#FFA500", "#800080", "#008000", "#800000",
        "#008080", "#000080", "#808000", "#808080", "#C0C0C0",
        "#FFD700", "#DA70D6", "#32CD32", "#FF4500", "#9400D3"
      ],
      'pensacola': [
        "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
        "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF",
        "#393B79", "#637939", "#8C6D31", "#843C39", "#7B4173",
        "#5254A3", "#8CA252", "#BD9E39", "#AD494A", "#A55194"
      ]
    };

    // Get venues with colors for the selected city
    const venues = await Venue.find({
      city: selectedCity,
      colorCode: { $exists: true, $ne: null }
    })
      .select("venueName colorCode verifiedOrder isActive")
      .sort({ venueName: 1 });

    // Get used colors
    const usedColors = venues.map(v => v.colorCode);
    const cityColors = CITY_COLOR_PALETTES[selectedCity] || CITY_COLOR_PALETTES['mobile'];

    const availableColors = cityColors.filter(
      color => !usedColors.includes(color)
    );

    // Group venues by color for display
    const colorAssignments = cityColors.map(color => {
      const venue = venues.find(v => v.colorCode === color);
      return {
        color,
        hex: color,
        venue: venue ? {
          id: venue._id,
          name: venue.venueName,
          verified: venue.verifiedOrder > 0,
          active: venue.isActive
        } : null,
        isAvailable: !venue
      };
    });

    res.status(200).json({
      success: true,
      data: {
        city: selectedCity,
        cityName: selectedCity.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        totalColors: cityColors.length,
        usedColors: usedColors.length,
        availableColors: availableColors.length,
        colorAssignments,
        availableColorsList: availableColors,
        venuesWithoutColor: await Venue.find({
          city: selectedCity,
          $or: [
            { colorCode: { $exists: false } },
            { colorCode: null }
          ]
        }).select("venueName _id").lean()
      }
    });
  } catch (error) {
    next(new ErrorResponse("Failed to fetch color management data", 500));
  }
};

// NEW: Assign/Change venue color by admin
export const assignVenueColor = async (req, res, next) => {
  try {
    const { venueId } = req.params;
    const { colorCode } = req.body;

    if (!colorCode) {
      return next(new ErrorResponse("Color code is required", 400));
    }

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return next(new ErrorResponse("Venue not found", 404));
    }

    const isValidColor = await ColorAssigner.validateColorForCity(
      colorCode,
      venue.city
    );

    if (!isValidColor) {
      return next(
        new ErrorResponse(
          `Invalid color for ${venue.city}. Must be one of the 20 city colors.`,
          400
        )
      );
    }
    const isAvailable = await ColorAssigner.isColorAvailable(
      colorCode,
      venue.city,
      venueId
    );

    if (!isAvailable) {
      const existingVenue = await Venue.findOne({
        city: venue.city,
        colorCode: colorCode,
        _id: { $ne: venueId }
      });

      return next(
        new ErrorResponse(
          `Color ${colorCode} is already assigned to ${existingVenue.venueName}`,
          400
        )
      );
    }

    // Update venue color
    const oldColor = venue.colorCode;
    venue.colorCode = colorCode;
    await venue.save();

    // Update events
    await Event.updateMany(
      { venue: venueId },
      { $set: { color: colorCode } }
    );

    res.status(200).json({
      success: true,
      message: `Color updated from ${oldColor || 'none'} to ${colorCode}`,
      data: { venue }
    });

  } catch (error) {
    next(new ErrorResponse("Failed to assign venue color", 500));
  }
};

// NEW: Reassign all colors for a city
export const reassignCityColors = async (req, res, next) => {
  try {
    const { city } = req.params;

    const validCities = ["new orleans", "biloxi", "mobile", "pensacola"];
    if (!validCities.includes(city.toLowerCase())) {
      return next(new ErrorResponse("Invalid city", 400));
    }

    // Color palettes
    const CITY_COLOR_PALETTES = {
      'new orleans': [
        "#FF6B6B", "#4ECDC4", "#FFD166", "#06D6A0", "#118AB2",
        "#073B4C", "#EF476F", "#7209B7", "#FF9E00", "#8338EC",
        "#3A86FF", "#FB5607", "#FF006E", "#8338EC", "#3A86FF",
        "#06D6A0", "#FFD166", "#EF476F", "#118AB2", "#7209B7"
      ],
      'biloxi': [
        "#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6",
        "#1ABC9C", "#D35400", "#C0392B", "#27AE60", "#8E44AD",
        "#16A085", "#E67E22", "#2980B9", "#D68910", "#A569BD",
        "#138D75", "#CA6F1E", "#7D3C98", "#117A65", "#B9770E"
      ],
      'mobile': [
        "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF",
        "#00FFFF", "#FFA500", "#800080", "#008000", "#800000",
        "#008080", "#000080", "#808000", "#808080", "#C0C0C0",
        "#FFD700", "#DA70D6", "#32CD32", "#FF4500", "#9400D3"
      ],
      'pensacola': [
        "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
        "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF",
        "#393B79", "#637939", "#8C6D31", "#843C39", "#7B4173",
        "#5254A3", "#8CA252", "#BD9E39", "#AD494A", "#A55194"
      ]
    };

    const cityColors = CITY_COLOR_PALETTES[city.toLowerCase()] || CITY_COLOR_PALETTES['mobile'];

    // Get all active venues in the city, sorted by creation date
    const venues = await Venue.find({
      city: city.toLowerCase(),
      isActive: true
    }).sort({ createdAt: 1 });

    let updateResults = [];

    // Reassign colors in order
    for (let i = 0; i < venues.length; i++) {
      const venue = venues[i];
      const colorIndex = i % cityColors.length;
      const newColor = cityColors[colorIndex];

      const oldColor = venue.colorCode;
      venue.colorCode = newColor;
      await venue.save();

      // Update events for this venue
      await Event.updateMany(
        { venue: venue._id },
        { $set: { color: newColor } }
      );

      updateResults.push({
        venueId: venue._id,
        venueName: venue.venueName,
        oldColor,
        newColor
      });
    }

    res.status(200).json({
      success: true,
      message: `Colors reassigned for ${venues.length} venues in ${city}`,
      data: {
        city,
        totalVenues: venues.length,
        updates: updateResults
      }
    });
  } catch (error) {
    next(new ErrorResponse("Failed to reassign city colors", 500));
  }
};


export const updateSubscriptionConfig = async (req, res, next) => {
  try {
    const { config } = req.body;

    // Validate admin permissions
    if (req.user.userType !== 'admin') {
      return next(new ErrorResponse("Admin access required", 403));
    }

    // Update config (in real implementation, save to database)
    // For now, we'll update the in-memory config
    Object.assign(SUBSCRIPTION_CONFIG, config);

    // Log the change
    console.log(`Subscription config updated by admin: ${req.user.username}`);
    console.log('New config:', SUBSCRIPTION_CONFIG.SYSTEM_WIDE);

    res.status(200).json({
      success: true,
      message: "Subscription configuration updated successfully",
      data: { config: SUBSCRIPTION_CONFIG }
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionConfig = (req, res) => {
  if (req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  res.status(200).json({
    success: true,
    data: { config: SUBSCRIPTION_CONFIG }
  });
};