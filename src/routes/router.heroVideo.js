import express from 'express';
import { getHeroSection, getUploadSignature, updateHeroSection } from '../controllers/controller.heroSection.js';
import { authorize, protect } from '../middleware/auth.js';


const router = express.Router();

// Public routes
router.get('/', getHeroSection);
router.put('/update', protect,
  authorize("admin"), updateHeroSection);
router.get('/upload-signature', getUploadSignature);

export default router;