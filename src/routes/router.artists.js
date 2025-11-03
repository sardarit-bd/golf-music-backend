import express from 'express';
import { authorize, protect } from '../middleware/auth.js';
import { validateArtistProfile } from '../middleware/validation.js';
import { createOrUpdateProfile, deleteArtistByAdmin, deleteArtistProfile, getArtist, getArtistsByGenre, getMyArtistProfile, updateArtistByAdmin, updateArtistProfile } from '../controllers/controllers.artist.js';
import { handleUploadErrors, uploadArtistFiles } from '../middleware/upload.js';



const router = express.Router();

router.get("/profile/me", protect, authorize("artist"), getMyArtistProfile);

// Create or update artist profile
router.post(
  '/profile',
  protect,
  authorize('artist'),
  uploadArtistFiles,
  handleUploadErrors,
  validateArtistProfile,
  createOrUpdateProfile
);

// Get all artists
router.get('/', getArtistsByGenre);

// Get artist by ID
router.get('/:id', getArtist);

// Explicit Update
router.put(
  '/profile', 
  protect,
  authorize('artist'),
  uploadArtistFiles,
  handleUploadErrors,
  validateArtistProfile,
  updateArtistProfile
);

// Delete
router.delete('/profile', protect, authorize('artist'), deleteArtistProfile);

// Admin routes for artist management
router.put(
  '/admin/:id',
  protect,
  authorize('admin'),
  updateArtistByAdmin
);

router.delete(
  '/admin/:id',
  protect,
  authorize('admin'),
  deleteArtistByAdmin
);

export default router;
