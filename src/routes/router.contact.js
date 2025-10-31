import express from 'express';

import { validateContact } from '../middleware/validation.js';
import { protect, authorize } from '../middleware/auth.js';
import { getContacts, submitContact } from '../controllers/controller.contact.js';

const router = express.Router();

// Public route — anyone can submit contact form
router.post('/', validateContact, submitContact);

// Admin route — only admin can view messages
router.get('/', protect, authorize('admin'), getContacts);

export default router;
