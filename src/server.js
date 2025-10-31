import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { CLIENT_URL, NODE_ENV, PORT } from './config/environment.js';
import { errorHandler } from './middleware/errorHandler.js';
import connectDB from './config/database.js';
import authRoutes from './routes/router.auth.js';
import artistRoutes from './routes/router.artists.js';
import journalistRoutes from './routes/router.journalists.js';
import venueRoutes from './routes/router.venue.js';
import eventRoutes from './routes/router.events.js';
import newsRoutes from './routes/router.news.js';
import contactRoutes from './routes/router.contact.js';
import adminRoutes from './routes/router.admin.js';
import { cloudinary } from './config/cloudinary.js';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
await connectDB();

const app = express();

// ===== Security middleware =====
app.use(helmet());

// ===== Rate limiting =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// ===== Compression middleware =====
app.use(compression());

// ===== CORS configuration =====



const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow non-browser requests
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);



// ===== Body parser middleware =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== Static files =====
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== API Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/journalists', journalistRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/news', newsRoutes);
// app.use('/api/calendar', calendarRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
// ===== Health check =====
app.get('/api/up', (req, res) => {
  res.json({
    success: true,
    message: 'Gulf Coast Music API is UP and running!',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ===== Error handler =====
app.use(errorHandler);

// ===== Handle unhandled promise rejections =====
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});

// cloudinary.api.ping()
//   .then(res => console.log("Cloudinary connected:", res))
//   .catch(err => console.error("Cloudinary connection failed:", err));


// ===== Start server =====
// const server = app.listen(PORT, () => {
//   console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
// });



// export default server;



//added for vercel hosting
export default app;
