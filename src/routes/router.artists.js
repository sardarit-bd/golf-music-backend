import express from 'express';
import { authorize, protect } from '../middleware/auth.js';
import { validateArtistProfile } from '../middleware/validation.js';
import { 

  changeArtistPlanByAdmin,
    createOrUpdateProfile, 
    deleteArtistByAdmin, 
    deleteArtistProfile, 
    getArtist, 
    getArtistsByGenre, 
    getArtistsForAdmin, 
    getMyArtistProfile, 
    updateArtistByAdmin, 
    updateArtistProfile 
} from '../controllers/controllers.artist.js';
import { handleUploadErrors, uploadArtistFiles } from '../middleware/upload.js';

const router = express.Router();

// Get current artist profile
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

// Get specific artist by ID
router.get('/:id', getArtist);

// Update artist profile
router.put(
    '/profile', 
    protect,
    authorize('artist'),
    uploadArtistFiles,
    handleUploadErrors,
    validateArtistProfile,
    updateArtistProfile
);

// Delete artist profile
router.delete('/profile', protect, authorize('artist'), deleteArtistProfile);

// Get all artists for admin with filtering
router.get(
    '/admin/artists',
    protect,
    authorize('admin'),
    getArtistsForAdmin 
);

// Update artist by admin
router.put(
    '/admin/:id',
    protect,
    authorize('admin'),
    updateArtistByAdmin
);

// Change artist plan by admin
router.put(
    '/admin/:id/plan',
    protect,
    authorize('admin'),
    changeArtistPlanByAdmin 
);

// Delete artist by admin
router.delete(
    '/admin/:id',
    protect,
    authorize('admin'),
    deleteArtistByAdmin
);

export default router;