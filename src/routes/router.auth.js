import express from 'express';
import { validateRegistration, validateLogin } from '../middleware/validation.js';
import { getMe, login, register } from '../controllers/controllers.auth.js';
import {protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.get('/me', protect, getMe);

export default router;
