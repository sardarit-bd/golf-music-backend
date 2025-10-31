import express from 'express';
import { authorize, protect } from '../middleware/auth.js';
import { validateEvent, validateEventUpdate } from '../middleware/validation.js';
import { createEvent, deleteEvent, getEvent, getEventsByCity, getMyEvents, getUpcomingEvents, updateEvent } from '../controllers/controller.event.js';


const router = express.Router();

// Create a new event (Venue only)
router.post('/', protect, authorize('venue'), validateEvent, createEvent);

// Get all events by city (Public)
router.get('/', getEventsByCity);

// Get upcoming events (Public)
router.get('/upcoming', getUpcomingEvents);

// Get all events created by current venue (Private)
router.get('/venue/my-events', protect, authorize('venue'), getMyEvents);

// Get a single event by ID (Public)
router.get('/:id', getEvent);

// Update event (Venue only)
router.put('/:id', protect, authorize('venue'), validateEventUpdate, updateEvent);

// Delete event (Venue only)
router.delete('/:id', protect, authorize('venue'), deleteEvent);

export default router;
