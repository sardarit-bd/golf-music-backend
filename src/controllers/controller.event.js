import { validationResult } from 'express-validator';
import Venue from '../models/model.venue.js';
import Event from '../models/models.event.js';

const venueColors = [
  '#0000FF', '#008000', '#FF0000', '#800080', '#FFA500',
  '#FFFF00', '#FFC0CB', '#A52A2A', '#FFFFFF', '#000000'
];

// Create Event
export const createEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { artistBandName, time, date, description } = req.body;

    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue profile not found. Please create your venue profile first.',
      });
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

    await event.populate('venue', 'venueName city address');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event },
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating event',
    });
  }
};

// Get Events By City
export const getEventsByCity = async (req, res) => {
  try {
    const { city } = req.query;
    const defaultCity = 'mobile';
    let query = { isActive: true };

    query.city = city && city !== 'all' ? city.toLowerCase() : defaultCity;

    const events = await Event.find(query)
      .populate('venue', 'venueName city address seatingCapacity')
      .sort({ date: 1, time: 1 });

    res.json({
      success: true,
      data: {
        events,
        filters: {
          currentCity: city || defaultCity,
          availableCities: ['new orleans', 'biloxi', 'mobile', 'pensacola'],
        },
      },
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching events',
    });
  }
};

// Get Single Event by ID
export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('venue', 'venueName city address seatingCapacity openHours openDays');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.json({
      success: true,
      data: { event },
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching event',
    });
  }
};

// Get Events of Current Venue Owner
export const getMyEvents = async (req, res) => {
  try {
    const venue = await Venue.findOne({ user: req.user.id });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue profile not found',
      });
    }

    const events = await Event.find({ venue: venue._id })
      .populate('venue', 'venueName city')
      .sort({ date: -1 });

    res.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Get venue events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching venue events',
    });
  }
};

// Update Event
export const updateEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { artistBandName, time, date, description } = req.body;

    const event = await Event.findById(req.params.id).populate('venue');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue || event.venue._id.toString() !== venue._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event',
      });
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { artistBandName, time, date, description },
      { new: true, runValidators: true }
    ).populate('venue', 'venueName city address');

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: { event: updatedEvent },
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating event',
    });
  }
};

// Delete (Soft Delete)
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('venue');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const venue = await Venue.findOne({ user: req.user.id });
    if (!venue || event.venue._id.toString() !== venue._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event',
      });
    }

    await Event.findByIdAndUpdate(req.params.id, { isActive: false });

    res.json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting event',
    });
  }
};

// Upcoming Events
export const getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.find({
      isActive: true,
      date: { $gte: new Date() },
    })
      .populate('venue', 'venueName city address')
      .sort({ date: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming events',
    });
  }
};
