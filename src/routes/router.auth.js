import express from 'express';
import { 
  validateRegistration, 
  validateLogin, 
  validateResetPassword, 
  validateForgotPassword 
} from '../middleware/validation.js';
import { 
  forgotPassword, 
  getMe, 
  login, 
  register, 
  resetPassword,
  updateProfile,
  getUsersByLocation
} from '../controllers/controllers.auth.js';
import { protect } from '../middleware/auth.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.put('/reset-password/:token', validateResetPassword, resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/by-location', protect, getUsersByLocation);

export default router;