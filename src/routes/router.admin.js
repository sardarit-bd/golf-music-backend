import express from 'express';
import { 
    deleteContactMessage, 
    deleteUser, 
    getAdminProfile, 
    getAllUsers, 
    getContactMessages, 
    getContentForModeration, 
    getDashboardStats, 
    getSystemSettings, 
    markContactAsRead, 
    promoteUserToAdmin, 
    toggleContentStatus, 
    updateAdminProfile, 
    updateUser, 
    verifyUser,
    getNewsForAdmin,
    updateNewsByAdmin,
    toggleNewsStatus,
    deleteNewsByAdmin
} from '../controllers/controller.admin.js';
import { validateAdminActions } from '../middleware/validation.js';
import { authorize, protect } from '../middleware/auth.js';
import { uploadAdminProfilePhoto, uploadNewsPhotos, handleUploadErrors } from '../middleware/upload.js';

const router = express.Router();

// Protect all admin routes
router.use(protect, authorize('admin'));

// ============================
// Admin Profile Routes
// ============================
router.get("/profile", getAdminProfile);
router.put("/profile", uploadAdminProfilePhoto, updateAdminProfile);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Promote user to admin
router.post('/users/:id/promote', authorize('super_admin'), promoteUserToAdmin);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/verify', validateAdminActions, verifyUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Content moderation
router.get('/content', getContentForModeration);
router.put('/content/:type/:id/toggle', validateAdminActions, toggleContentStatus);

router.get('/news', getNewsForAdmin);

router.put(
  '/news/:id', 
  uploadNewsPhotos,
  handleUploadErrors,
  updateNewsByAdmin
);

router.put('/news/:id/toggle', toggleNewsStatus);
router.delete('/news/:id', deleteNewsByAdmin);

// Contact management
router.get('/contacts', getContactMessages);
router.put('/contacts/:id/read', markContactAsRead);
router.delete('/contacts/:id', deleteContactMessage);

// System settings
router.get('/settings', getSystemSettings);

export default router;