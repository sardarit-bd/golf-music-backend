import express from 'express';
import { authorize, protect } from '../middleware/auth.js';
import { handleUploadErrors, uploadNewsPhotos } from '../middleware/upload.js';
import { validateNews, validateNewsUpdate } from '../middleware/validation.js';
import { 
  createNews, 
  deleteNews, 
  getFeaturedNews,
  getMyNews, 
  getNews, 
  getNewsByLocation, 
  getNewsStats,
  searchNews,
  updateNews 
} from '../controllers/controller.news.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.get('/', getNewsByLocation);
router.get('/search', searchNews);
router.get('/featured', getFeaturedNews);
router.get('/stats', getNewsStats);
router.get('/:id', getNews);

// ==================== JOURNALIST ROUTES ====================
router.use(protect, authorize('journalist'));

router.get('/journalist/my-news', getMyNews); 
router.post(
  '/',
  uploadNewsPhotos,
  handleUploadErrors,
  validateNews,
  createNews
);

router.put(
  '/:id',
  uploadNewsPhotos,
  handleUploadErrors,
  validateNewsUpdate,
  updateNews
);

router.delete('/:id', deleteNews);

export default router;