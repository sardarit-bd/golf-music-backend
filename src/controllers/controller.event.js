import { validationResult } from "express-validator";
import Venue from "../models/model.venue.js";
import Event from "../models/models.event.js";
import { ErrorResponse } from "../middleware/errorHandler.js";


const validCities = ["new orleans", "biloxi", "mobile", "pensacola"];

const buildUtcDateOnly = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

// CREATE EVENT
export const createEvent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse("Validation failed", 400, { details: errors.array() })
      );
    }

    const { artistBandName, time, date, description } = req.body;

    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue) {
      return next(
        new ErrorResponse(
          "Venue profile not found. Please create your venue profile first.",
          404
        )
      );
    }

    const isPro = req.user.subscriptionPlan === "pro";

    // FREE PLAN → LIMIT 1 EVENT PER MONTH
    if (!isPro) {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const endOfMonth = new Date(
        Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      );

      const eventsThisMonth = await Event.countDocuments({
        venue: venue._id,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        isActive: true,
      });

      if (eventsThisMonth >= 1) {
        return next(
          new ErrorResponse(
            "Free plan allows only 1 show per month. Upgrade to Pro for unlimited shows.",
            403
          )
        );
      }
    }
    const imageData = req.file
      ? { url: req.file.path, filename: req.file.filename }
      : null;

    const utcDate = buildUtcDateOnly(date);

    const event = await Event.create({
      artistBandName,
      time,
      date: utcDate,
      description,
      image: imageData,
      venue: venue._id,
      city: venue.city,
    });

    await event.populate("venue", "venueName city address colorCode");

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// GET EVENTS BY CITY - FIXED DEFAULT CITY
export const getEventsByCity = async (req, res, next) => {
  try {
    const { city = "mobile" } = req.query;
    let query = { isActive: true };

    if (city && city !== "all" && validCities.includes(city.toLowerCase())) {
      query.city = city.toLowerCase();
    } else {
      query.city = "mobile";
    }

    const events = await Event.find(query)
      .populate("venue", "venueName city address seatingCapacity colorCode")
      .sort({ date: 1, time: 1 });

    res.status(200).json({
      success: true,
      data: {
        events,
        filters: {
          currentCity: query.city,
          availableCities: validCities,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET CALENDAR EVENTS BY CITY (SPECIFIC FOR CALENDAR)
export const getCalendarEvents = async (req, res, next) => {
  try {
    const { city = "mobile" } = req.query;

    const selectedCity = validCities.includes(city.toLowerCase())
      ? city.toLowerCase()
      : "mobile";

    const events = await Event.find({
      city: selectedCity,
      isActive: true,
      date: { $gte: new Date().setHours(0, 0, 0, 0) },
    })
      .populate("venue", "venueName colorCode verifiedOrder")
      .sort({ date: 1, time: 1 })
      .select("artistBandName date time venue city image");

    const calendarEvents = events.map((event) => ({
      id: event._id,
      title: event.artistBandName,
      date: event.date,
      time: event.time,
      venue: event.venue?.venueName || "Unknown Venue",
      color: event.venue?.colorCode || "#000000",
      city: event.city,
      image: event.image,
    }));

    res.status(200).json({
      success: true,
      data: {
        events: calendarEvents,
        currentCity: selectedCity,
        availableCities: validCities,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE EVENT BY ID
export const getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "venue",
      "venueName city address seatingCapacity openHours openDays colorCode"
    );

    if (!event) {
      return next(new ErrorResponse("Event not found", 404));
    }

    res.status(200).json({
      success: true,
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// GET EVENTS OF CURRENT VENUE OWNER
export const getMyEvents = async (req, res, next) => {
  try {
    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue) {
      return next(new ErrorResponse("Venue profile not found", 404));
    }

    const events = await Event.find({ venue: venue._id })
      .populate("venue", "venueName city colorCode")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE EVENT
export const updateEvent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse("Validation failed", 400, { details: errors.array() })
      );
    }

    const { artistBandName, time, date, description } = req.body;

    const event = await Event.findById(req.params.id).populate("venue");
    if (!event) {
      return next(new ErrorResponse("Event not found", 404));
    }

    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue || event.venue._id.toString() !== venue._id.toString()) {
      return next(
        new ErrorResponse("Not authorized to update this event", 403)
      );
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { artistBandName, time, date, description },
      { new: true, runValidators: true }
    )
    .populate("venue", "venueName city address colorCode");

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE (SOFT DELETE)
export const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate("venue");
    if (!event) {
      return next(new ErrorResponse("Event not found", 404));
    }

    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue || event.venue._id.toString() !== venue._id.toString()) {
      return next(
        new ErrorResponse("Not authorized to delete this event", 403)
      );
    }

    await Event.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// UPCOMING EVENTS
export const getUpcomingEvents = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.find({
      isActive: true,
      date: { $gte: new Date() },
    })
      .populate("venue", "venueName city address colorCode")
      .sort({ date: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};

/* =====================================
   GET EVENTS FOR ADMIN
===================================== */
export const getEventsForAdmin = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      city = "",
    } = req.query;

    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { artistBandName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status !== "all") {
      query.isActive = status === "active";
    }

    // City filter
    if (city && city !== "all") {
      query.city = city.toLowerCase();
    }

    const events = await Event.find(query)
      .populate("venue", "venueName city address seatingCapacity colorCode")
      .sort({ date: -1, time: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE EVENT BY ADMIN
export const updateEventByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { artistBandName, time, date, description, city, isActive } =
      req.body;

    let event = await Event.findById(id);
    if (!event) {
      return next(new ErrorResponse("Event not found", 404));
    }

    const updateData = {
      ...(artistBandName && { artistBandName }),
      ...(time && { time }),
      ...(date && { date }),
      ...(description && { description }),
      ...(city && { city: city.toLowerCase() }),
      ...(isActive !== undefined && { isActive }),
    };

    event = await Event.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
    .populate("venue", "venueName city address seatingCapacity colorCode");

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// TOGGLE EVENT STATUS (ACTIVE/INACTIVE)
export const toggleEventStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return next(new ErrorResponse("Event not found", 404));
    }

    event.isActive = !event.isActive;
    await event.save();

    res.status(200).json({
      success: true,
      message: `Event ${
        event.isActive ? "activated" : "deactivated"
      } successfully`,
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE EVENT BY ADMIN
export const deleteEventByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return next(new ErrorResponse("Event not found", 404));
    }

    await Event.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Event permanently deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// NEW: GET EVENTS BY VENUE ID (for admin color management)
export const getEventsByVenueId = async (req, res, next) => {
  try {
    const { venueId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return next(new ErrorResponse("Venue not found", 404));
    }

    const events = await Event.find({ venue: venueId })
      .populate("venue", "venueName city colorCode")
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Event.countDocuments({ venue: venueId });

    res.status(200).json({
      success: true,
      data: {
        venue: {
          id: venue._id,
          name: venue.venueName,
          city: venue.city,
          colorCode: venue.colorCode,
          totalEvents: total
        },
        events,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// NEW: BULK UPDATE EVENT COLORS (for admin when venue color changes)
export const bulkUpdateEventColors = async (req, res, next) => {
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

    // Update all events for this venue with the new color
    const result = await Event.updateMany(
      { venue: venueId },
      { $set: { color: colorCode } }
    );

    // Update venue color
    venue.colorCode = colorCode;
    await venue.save();

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} events with color ${colorCode}`,
      data: {
        venue: {
          id: venue._id,
          name: venue.venueName,
          colorCode: venue.colorCode
        },
        eventsUpdated: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};
