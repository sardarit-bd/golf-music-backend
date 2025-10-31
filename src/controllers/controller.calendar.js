import { validationResult } from 'express-validator';
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
        errors: errors.array()
      });
    }

    const { artistBandName, time, date, venueId } = req.body;

    // Assign color based on total number of events for that venue
    const venueEventsCount = await Event.countDocuments({ venue: venueId });
    const color = venueColors[venueEventsCount % venueColors.length];

    const event = await Event.create({
      artistBandName,
      time,
      date,
      venue: venueId,
      color
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event }
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating event'
    });
  }
};

// Get Events By City
export const getEventsByCity = async (req, res) => {
  try {
    const { city } = req.query;
    const defaultCity = 'mobile';

    const events = await Event.find({
      city: city ? city.toLowerCase() : defaultCity,
      isActive: true
    })
      .populate('venue', 'venueName city address')
      .sort({ date: 1, time: 1 });

    res.status(200).json({
      success: true,
      data: { events }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching events'
    });
  }
};

// Get Single Event
export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('venue', 'venueName city address');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { event }
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching event'
    });
  }
};
