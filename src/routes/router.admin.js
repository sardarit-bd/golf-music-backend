import express from 'express';
import { 
    deleteContactMessage, 
    deleteUser, 
    getAllUsers, 
    getContactMessages, 
    getContentForModeration, 
    getDashboardStats, 
    getSystemSettings, 
    markContactAsRead, 
    toggleContentStatus, 
    verifyUser 
} from '../controllers/controller.admin.js';
import { validateAdminActions } from '../middleware/validation.js';
import { authorize, protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all admin routes and authorize only admin users
router.use(protect, authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/verify', validateAdminActions, verifyUser);
router.delete('/users/:id', deleteUser);

// Content moderation
router.get('/content', getContentForModeration);
router.put('/content/:type/:id/toggle', validateAdminActions, toggleContentStatus);

// Contact management
router.get('/contacts', getContactMessages);
router.put('/contacts/:id/read', markContactAsRead);
router.delete('/contacts/:id', deleteContactMessage);

// System settings
router.get('/settings', getSystemSettings);

export default router;
