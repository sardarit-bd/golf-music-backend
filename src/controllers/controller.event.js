import { validationResult } from "express-validator";
import Venue from "../models/model.venue.js";
import Event from "../models/models.event.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import StateCity from "../models/stateCity.model.js";
import { DEFAULT_CITY, DEFAULT_STATE, STATE_CITY_MAPPING } from "../utils/constants.js";


const validCities = ["new orleans", "biloxi", "mobile", "pensacola"];

export const parseEventDate = (dateString, timeString) => {
  try {
    // console.log("Parsing date:", dateString, "time:", timeString);

    // Validate date format (MM/DD/YYYY)
    const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!dateRegex.test(dateString)) {
      throw new Error('Date must be in MM/DD/YYYY format (e.g., 01/21/2024)');
    }

    // Validate time format (HH:MM AM/PM)
    const timeRegex = /^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(am|pm|AM|PM)$/;
    if (!timeRegex.test(timeString)) {
      throw new Error('Time must be in HH:MM AM/PM format (e.g., 08:30 PM)');
    }

    // Parse date components
    const [month, day, year] = dateString.split('/').map(Number);

    // Parse time components
    const timeMatch = timeString.match(timeRegex);
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const period = timeMatch[3].toLowerCase();

    // Convert to 24-hour format
    if (period === 'pm' && hours < 12) {
      hours += 12;
    }
    if (period === 'am' && hours === 12) {
      hours = 0;
    }

    // Validate date
    const dateObj = new Date(year, month - 1, day, hours, minutes);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() + 1 !== month ||
      dateObj.getDate() !== day
    ) {
      throw new Error('Invalid date (e.g., February 30th)');
    }

    // Check if date is in the past
    const now = new Date();
    if (dateObj < now) {
      throw new Error('Event date cannot be in the past');
    }

    // Create UTC date
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    // Create dateOnly (UTC date without time)
    const dateOnly = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    // console.log("Parsed results:", {
    //   fullDate: utcDate,
    //   dateOnly: dateOnly,
    //   timeString: timeString
    // });

    return {
      fullDate: utcDate,
      dateOnly: dateOnly,
      timeString: timeString,
      original: {
        date: dateString,
        time: timeString
      }
    };

  } catch (error) {
    console.error("Date parsing error:", error.message);
    throw new Error(`Invalid date/time: ${error.message}`);
  }
};
/**
 * Format date for display
 */
const formatDateForDisplay = (utcDate) => {
  const date = new Date(utcDate);
  // Convert to local time
  const localDate = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes()
  );

  return {
    localDate,
    formatted: localDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    time: localDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  };
};

// ==================== MAIN CONTROLLER FUNCTIONS ====================


// CREATE EVENT - UPDATED WITH STATE SUPPORT
export const createEvent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse("Validation failed", 400, { details: errors.array() })
      );
    }

    const { artistBandName, time, date, description } = req.body;
    // console.log("Creating event with data:", { artistBandName, time, date, description });

    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue) {
      return next(
        new ErrorResponse(
          "Venue profile not found. Please create your venue profile first.",
          404
        )
      );
    }

    // console.log("Found venue:", {
    //   name: venue.venueName,
    //   state: venue.state,
    //   city: venue.city,
    //   colorCode: venue.colorCode
    // });

    // Validate venue's state and city
    const stateCities = STATE_CITY_MAPPING[venue.state] || [];
    if (!stateCities.includes(venue.city.toLowerCase())) {
      return next(
        new ErrorResponse(
          `Your venue city "${venue.city}" is not valid for state "${venue.state}".`,
          400
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
        dateOnly: { $gte: startOfMonth, $lte: endOfMonth },
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

    // Parse date with correct timezone handling
    const parsedDate = parseEventDate(date, time);
    // console.log("Parsed date:", parsedDate);

    const imageData = req.file
      ? { url: req.file.path, filename: req.file.filename }
      : null;

    // Create event object with all required fields
    const eventData = {
      artistBandName,
      eventTime: time,
      date: parsedDate.fullDate,
      dateOnly: parsedDate.dateOnly,
      description: description || "",
      image: imageData,
      venue: venue._id,
      state: venue.state,
      city: venue.city,
      color: venue.colorCode || "#000000",
    };

    // Create event
    const event = await Event.create(eventData);

    // Populate venue details
    await event.populate("venue", "venueName state city address colorCode");

    // Also update venue's shows array
    venue.shows.push({
      artist: artistBandName,
      date: parsedDate.fullDate,
      time: time,
    });
    await venue.save();

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { event },
    });
  } catch (error) {
    console.error("Create event error:", error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return next(
        new ErrorResponse("Event validation failed", 400, { details: errors })
      );
    }

    next(new ErrorResponse(error.message || "Failed to create event", 500));
  }
};

// GET EVENTS BY STATE AND CITY - NEW
export const getEventsByStateCity = async (req, res, next) => {
  try {
    const { state = DEFAULT_STATE, city = DEFAULT_CITY } = req.query;

    let query = { isActive: true };

    // Validate state
    if (state && STATE_CITY_MAPPING[state]) {
      query.state = state;

      // Validate city for the state
      const stateCities = STATE_CITY_MAPPING[state];
      if (city && city !== 'all') {
        if (stateCities.includes(city.toLowerCase())) {
          query.city = city.toLowerCase();
        } else {
          // Fallback to first city in state
          query.city = stateCities[0];
        }
      } else {
        // Get all cities in the state
        query.city = { $in: stateCities };
      }
    } else {
      // Default to Alabama, Mobile
      query.state = DEFAULT_STATE;
      query.city = DEFAULT_CITY;
    }

    const events = await Event.find(query)
      .populate("venue", "venueName state city address seatingCapacity colorCode verifiedOrder")
      .sort({ date: 1, eventTime: 1 });

    res.status(200).json({
      success: true,
      data: {
        events,
        filters: {
          currentState: query.state,
          currentCity: query.city,
          availableStates: Object.keys(STATE_CITY_MAPPING),
          availableCities: STATE_CITY_MAPPING[query.state] || [],
        },
      },
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

// GET CALENDAR EVENTS - UPDATED WITH CUSTOM VENUE SUPPORT
export const getCalendarEvents = async (req, res, next) => {
  try {
    const { state = DEFAULT_STATE, city = DEFAULT_CITY } = req.query;

    const query = {
      isActive: true,
      dateOnly: { $gte: new Date().setHours(0, 0, 0, 0) },
    };

    // Validate state and city
    if (state && STATE_CITY_MAPPING[state]) {
      query.state = state;

      const stateCities = STATE_CITY_MAPPING[state];

      if (city && city !== "all") {
        if (stateCities.includes(city.toLowerCase())) {
          query.city = city.toLowerCase();
        } else {
          query.city = stateCities[0];
        }
      } else {
        query.city = { $in: stateCities };
      }
    } else {
      query.state = DEFAULT_STATE;
      query.city = DEFAULT_CITY;
    }

    const events = await Event.find(query)
      .populate("venue", "venueName colorCode verifiedOrder state city")
      .sort({ dateOnly: 1, eventTime: 1 })
      .select(
        "artistBandName date dateOnly eventTime venue customVenueName state city image color description"
      );

    const calendarEvents = events.map((event) => {
      const eventDate = new Date(event.date);

      const localDate = new Date(
        eventDate.getUTCFullYear(),
        eventDate.getUTCMonth(),
        eventDate.getUTCDate(),
        eventDate.getUTCHours(),
        eventDate.getUTCMinutes()
      );

      const venueName =
        event.venue?.venueName ||
        event.customVenueName ||
        "Unknown Venue";

      const isCustomVenue = !event.venue && !!event.customVenueName;

      return {
        id: event._id,
        title: event.artistBandName,
        date: localDate,
        time: event.eventTime,

        venue: venueName,
        venueId: event.venue?._id || null,

        customVenueName: event.customVenueName || "",
        isCustomVenue,

        color: event.venue?.colorCode || event.color || "#000000",
        state: event.state,
        city: event.city,
        image: event.image,
        description: event.description || "",

        verified: event.venue?.verifiedOrder > 0,

        rawDate: event.date,
        dateOnly: event.dateOnly,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        events: calendarEvents,
        currentState: query.state,
        currentCity: query.city,
        availableStates: Object.keys(STATE_CITY_MAPPING),
        availableCities: STATE_CITY_MAPPING[query.state] || [],
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

// GET EVENTS FOR ADMIN - UPDATED WITH STATE FILTER
export const getEventsForAdmin = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      state = "",
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

    // State filter
    if (state && state !== "all") {
      query.state = state;
    }

    // City filter
    if (city && city !== "all") {
      query.city = city.toLowerCase();
    } else if (state && state !== "all") {
      // If state selected but city not, show all cities in that state
      const stateCities = STATE_CITY_MAPPING[state] || [];
      query.city = { $in: stateCities };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.find(query)
      .populate({
        path: "venue",
        select: "venueName state city address seatingCapacity colorCode",
        options: {
          lean: true,
          allowNull: true
        }
      })
      .sort({ date: -1, eventTime: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Event.countDocuments(query);

    const processedEvents = events.map(event => ({
      ...event.toObject(),
      venue: event.venue || {
        venueName: "N/A",
        state: "Unknown",
        city: "Unknown",
        address: "",
        seatingCapacity: 0,
        colorCode: "#cccccc"
      }
    }));

    res.status(200).json({
      success: true,
      data: {
        events: processedEvents,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
        filters: {
          availableStates: Object.keys(STATE_CITY_MAPPING),
          selectedState: state,
          selectedCity: city
        }
      },
    });
  } catch (error) {
    console.error("Error in getEventsForAdmin:", error);
    next(new ErrorResponse("Failed to fetch events: " + error.message, 500));
  }
};

// UPDATE EVENT BY ADMIN - UPDATED WITH STATE SUPPORT
export const updateEventByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { artistBandName, time, date, description, state, city, isActive } = req.body;

    let event = await Event.findById(id);
    if (!event) {
      return next(new ErrorResponse("Event not found", 404));
    }

    // Parse date if provided
    let parsedDate = null;
    if (date && time) {
      parsedDate = parseEventDate(date, time);
    }

    const updateData = {
      ...(artistBandName && { artistBandName }),
      ...(time && { eventTime: time }),
      ...(parsedDate && {
        date: parsedDate.fullDate,
        dateOnly: parsedDate.dateOnly
      }),
      ...(description && { description }),
      ...(state && { state }),
      ...(city && { city: city.toLowerCase() }),
      ...(isActive !== undefined && { isActive }),
    };

    event = await Event.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("venue", "venueName state city address seatingCapacity colorCode");

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

export const createEventByAdmin = async (req, res, next) => {
  try {
    const {
      artistBandName,
      time,
      date,
      description,
      venueId,
      customVenueName,
      state,
      city,
    } = req.body;

    if (!artistBandName || !time || !date) {
      return next(new ErrorResponse("Artist/Band name, date and time are required", 400));
    }

    if (!venueId && !customVenueName) {
      return next(new ErrorResponse("Select existing venue or enter custom venue name", 400));
    }

    let venue = null;
    let eventState = state;
    let eventCity = city?.toLowerCase();
    let eventColor = "#000000";

    if (venueId) {
      venue = await Venue.findById(venueId);

      if (!venue) {
        return next(new ErrorResponse("Venue not found", 404));
      }

      eventState = venue.state;
      eventCity = venue.city;
      eventColor = venue.colorCode || "#000000";
    } else {
      if (!state || !city) {
        return next(new ErrorResponse("State and city are required for custom venue", 400));
      }
    }

    const parsedDate = parseEventDate(date, time);

    const imageData = req.file
      ? { url: req.file.path, filename: req.file.filename }
      : null;

    const event = await Event.create({
      artistBandName,
      eventTime: time,
      date: parsedDate.fullDate,
      dateOnly: parsedDate.dateOnly,
      description: description || "",
      image: imageData,

      venue: venue?._id || null,
      customVenueName: customVenueName || "",

      state: eventState,
      city: eventCity,
      color: eventColor,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Event added to live calendar successfully",
      data: { event },
    });
  } catch (error) {
    next(new ErrorResponse(error.message || "Failed to create event", 500));
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
      message: `Event ${event.isActive ? "activated" : "deactivated"
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

    // Update venue color
    venue.colorCode = colorCode;
    await venue.save();

    // Update all events for this venue with new color
    const updateResult = await Event.updateMany(
      { venue: venueId },
      { $set: { color: colorCode } }
    );

    res.status(200).json({
      success: true,
      message: `Venue color updated successfully. ${updateResult.modifiedCount} events updated.`,
      data: {
        venue: {
          id: venue._id,
          name: venue.venueName,
          colorCode: venue.colorCode,
        },
        affectedEvents: updateResult.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};
