import express from 'express';
import { authorize, protect } from '../middleware/auth.js';
import { handleUploadErrors, uploadJournalistPhoto } from '../middleware/upload.js';
import { validateJournalistProfile } from '../middleware/validation.js';
import { 
  createOrUpdateProfile,
  deleteJournalistProfile, 
  getAllJournalists, 
  getJournalist,  
  getProfile, 
  updateJournalistProfile, 
  verifyJournalist 
} from '../controllers/controllers.journalist.js';


const router = express.Router();


    // CREATE or UPDATE (Auto)

router.post(
  '/profile',
  protect,
  authorize('journalist'),
  uploadJournalistPhoto,
  handleUploadErrors,
  validateJournalistProfile,
  createOrUpdateProfile
);


// UPDATE (Explicit PUT)

router.put(
  '/profile',
  protect,
  authorize('journalist'),
  uploadJournalistPhoto,
  handleUploadErrors,
  validateJournalistProfile,
  updateJournalistProfile
);


//  DELETE Journalist Profile
router.delete(
  '/profile',
  protect,
  authorize('journalist'),
  deleteJournalistProfile
);


//  GET Own Profile
router.get('/profile', protect, authorize('journalist'), getProfile);


// PUBLIC ROUTES

router.get('/', getAllJournalists);
router.get('/:id', getJournalist);
// router.get('/:id/news', getJournalistNews);


// VERIFY Journalist (Admin)

router.put('/:id/verify', protect, authorize('admin'), verifyJournalist);

export default router;
