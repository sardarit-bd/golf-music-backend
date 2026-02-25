import express from 'express';
import { 
  getHeroSection, 
  getUploadSignature, 
  updateHeroSection,
  getHeroField 
} from '../controllers/controller.heroSection.js';
import { authorize, protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getHeroSection);
router.get('/field/:field', getHeroField); // Get specific field

// Protected routes (admin only)
router.put('/update', protect, authorize("admin"), updateHeroSection);
router.get('/upload-signature', protect, authorize("admin"), getUploadSignature);

export default router;