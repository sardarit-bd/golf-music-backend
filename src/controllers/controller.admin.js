import { ErrorResponse } from "../middleware/errorHandler.js";
import Artist from "../models/model.artist.js";
import News from "../models/model.news.js";
import User from "../models/model.user.js";
import Venue from "../models/model.venue.js";
import Contact from "../models/models.contact.js";
import Event from "../models/models.event.js";

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
        .populate("venue", "venueName city")
        .sort({ date: 1 })
        .limit(5),
    ]);

    const userStats = await User.aggregate([
      { $group: { _id: "$userType", count: { $sum: 1 } } },
    ]);

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
        },
        userStats,
        recentUsers,
        upcomingEvents: recentEvents,
      },
    });
  } catch (error) {
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
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    next(new ErrorResponse("Failed to fetch users", 500));
  }
};

// @desc    Verify user
export const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, verificationRequested: false },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return next(new ErrorResponse("User not found", 404));

    res.status(200).json({
      success: true,
      message: "User verified successfully",
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
    if (!user) return next(new ErrorResponse("User not found", 404));

    await User.findByIdAndUpdate(req.params.id, { isActive: false });

    if (user.userType === "artist")
      await Artist.findOneAndUpdate({ user: req.params.id }, { isActive: false });
    if (user.userType === "venue")
      await Venue.findOneAndUpdate({ user: req.params.id }, { isActive: false });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(new ErrorResponse("Error deleting user", 500));
  }
};

// @desc    Get all content for moderation
export const getContentForModeration = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    let model, populateField;

    switch (type) {
      case "artists":
        model = Artist;
        populateField = { path: "user", select: "username email" };
        break;
      case "venues":
        model = Venue;
        populateField = { path: "user", select: "username email" };
        break;
      case "news":
        model = News;
        populateField = { path: "journalist", select: "username email" };
        break;
      case "events":
        model = Event;
        populateField = { path: "venue", select: "venueName city" };
        break;
      default:
        return next(new ErrorResponse("Invalid content type", 400));
    }

    const content = await model
      .find({ isActive: true })
      .populate(populateField)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await model.countDocuments({ isActive: true });

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