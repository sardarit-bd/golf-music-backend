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

// ==================== ROUTE ORDER FIX ====================

router.get('/search', searchNews);           // GET /api/news/search
router.get('/featured', getFeaturedNews);    // GET /api/news/featured
router.get('/stats', getNewsStats);          // GET /api/news/stats
router.get('/journalist/my-news', protect, authorize('journalist'), getMyNews);


router.get('/', getNewsByLocation);          // GET /api/news
router.get('/:id', getNews);                 // GET /api/news/:id


router.post(
  '/',
  protect,
  authorize('journalist'),
  uploadNewsPhotos,
  handleUploadErrors,
  validateNews,
  createNews
);

router.put(
  '/:id',
  protect,
  authorize('journalist'),
  uploadNewsPhotos,
  handleUploadErrors,
  validateNewsUpdate,
  updateNews
);

router.delete(
  '/:id',
  protect,
  authorize('journalist'),
  deleteNews
);

export default router;