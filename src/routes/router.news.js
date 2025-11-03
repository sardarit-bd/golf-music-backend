import express from 'express';
import { authorize, protect } from '../middleware/auth.js';
import { handleUploadErrors, uploadNewsPhotos } from '../middleware/upload.js';
import { validateNews } from '../middleware/validation.js';
import { createNews, deleteNews, getMyNews, getNews, getNewsByLocation, updateNews } from '../controllers/controller.news.js';
import { deleteNewsByAdmin, getNewsForAdmin, toggleNewsStatus, updateNewsByAdmin } from '../controllers/controller.admin.js';


const router = express.Router();

router.get('/my-news', protect, authorize('journalist'), getMyNews);

router.get('/', getNewsByLocation);

router.get('/:id', getNews);

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
  validateNews,
  updateNews
);


router.delete('/:id', protect, authorize('journalist'), deleteNews);

// NEW: Admin routes for news management
router.get('/admin/news', protect, authorize('admin'), getNewsForAdmin);
router.put('/admin/:id', protect, authorize('admin'), updateNewsByAdmin);
router.put('/admin/:id/toggle', protect, authorize('admin'), toggleNewsStatus);
router.delete('/admin/:id', protect, authorize('admin'), deleteNewsByAdmin);

export default router;
