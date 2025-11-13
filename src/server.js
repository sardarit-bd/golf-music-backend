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
import merchRoutes from './routes/router.merch.js';
import castRoutes from './routes/route.cast.js';
import waveRoutes from './routes/route.wave.js';
import orderRoutes from './routes/router.order.js';
import { handleStripeWebhook } from './controllers/controller.merch.js';
import bodyParser from 'body-parser';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
await connectDB();

const app = express();

// ===== Security middleware =====
app.use(helmet());

// ===== Stripe Webhook MUST BE PLACED HERE BEFORE express.json() =====
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  handleStripeWebhook
);

// ===== Rate limiting =====
app.set('trust proxy', 1); 

const limiter = rateLimit({
  windowMs: 2 * 60 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later.",
    });
  },
});

app.use(limiter);

// ===== Compression middleware =====
app.use(compression());

// ===== CORS configuration =====
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "https://gulf-cost-music.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
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
app.use(express.json({ limit: '20mb' }));
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
app.use("/api/merch", merchRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/casts", castRoutes);
app.use("/api/waves", waveRoutes);
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

// ===== Root route =====
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Gulf Coast Music API Server',
    version: '1.0.0',
    environment: NODE_ENV,
  });
});

// ===== Error handler =====
app.use(errorHandler);

// ===== Handle unhandled promise rejections =====
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});

// ===== Start server =====
// const server = app.listen(PORT, () => {
//   console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
// });



// export default server;

//added for vercel hosting
export default app;
