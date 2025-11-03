import { validationResult } from "express-validator";
import Venue from "../models/model.venue.js";
import Event from "../models/models.event.js";
import { ErrorResponse } from "../middleware/errorHandler.js";

const venueColors = [
  "#0000FF",
  "#008000",
  "#FF0000",
  "#800080",
  "#FFA500",
  "#FFFF00",
  "#FFC0CB",
  "#A52A2A",
  "#FFFFFF",
  "#000000",
];


  //  CREATE EVENT

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

    const venueEventsCount = await Event.countDocuments({ venue: venue._id });
    const color = venueColors[venueEventsCount % venueColors.length];

    const event = await Event.create({
      artistBandName,
      time,
      date,
      description,
      venue: venue._id,
      city: venue.city,
      color,
    });

    await event.populate("venue", "venueName city address");

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};


  //  GET EVENTS BY CITY

export const getEventsByCity = async (req, res, next) => {
  try {
    const { city } = req.query;
    const defaultCity = "mobile";
    let query = { isActive: true };

    query.city = city && city !== "all" ? city.toLowerCase() : defaultCity;

    const events = await Event.find(query)
      .populate("venue", "venueName city address seatingCapacity")
      .sort({ date: 1, time: 1 });

    res.status(200).json({
      success: true,
      data: {
        events,
        filters: {
          currentCity: city || defaultCity,
          availableCities: ["new orleans", "biloxi", "mobile", "pensacola"],
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


  //  GET SINGLE EVENT BY ID

export const getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "venue",
      "venueName city address seatingCapacity openHours openDays"
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


  //  GET EVENTS OF CURRENT VENUE OWNER

export const getMyEvents = async (req, res, next) => {
  try {
    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue) {
      return next(new ErrorResponse("Venue profile not found", 404));
    }

    const events = await Event.find({ venue: venue._id })
      .populate("venue", "venueName city")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};


  //  UPDATE EVENT

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
    ).populate("venue", "venueName city address");

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};


  //  DELETE (SOFT DELETE)

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


  //  UPCOMING EVENTS

export const getUpcomingEvents = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.find({
      isActive: true,
      date: { $gte: new Date() },
    })
      .populate("venue", "venueName city address")
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
    const { page = 1, limit = 10, search = "", status = "all", city = "" } = req.query;
    
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { artistBandName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } }
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
      .populate("venue", "venueName city address seatingCapacity")
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
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};


  //  UPDATE EVENT BY ADMIN

export const updateEventByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { artistBandName, time, date, description, city, isActive } = req.body;

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
      ...(isActive !== undefined && { isActive })
    };

    event = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("venue", "venueName city address seatingCapacity");

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};


  //  TOGGLE EVENT STATUS (ACTIVE/INACTIVE)

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
      message: `Event ${event.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};


  //  DELETE EVENT BY ADMIN

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