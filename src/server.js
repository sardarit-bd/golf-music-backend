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

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect DB
await connectDB();

const app = express();

// ===============================
// Security middleware
// ===============================
app.use(helmet());

// ===============================
// STRIPE WEBHOOK (MUST BE FIRST)
// ===============================
// NO bodyParser here
// NO express.json BEFORE THIS!

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// ===============================
// Rate limiting
// ===============================
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 2 * 60 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Try again later.",
    });
  },
});

app.use(limiter);

// ===============================
// Compression middleware
// ===============================
app.use(compression());

// ===============================
// CORS
// ===============================

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin (mobile, Postman)
      if (!origin) return callback(null, true);

      // Allow all Vercel frontend subdomains
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      // Localhost always allowed
      if (origin.startsWith("http://localhost")) {
        return callback(null, true);
      }

      // Allowed list
      const allowed = [
        CLIENT_URL,
        "https://gulf-cost-music.vercel.app",
        "https://golf-music.vercel.app",
      ];

      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ===============================
// JSON Body Parser (AFTER Webhook!)
// ===============================
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// ===============================
// Static Files
// ===============================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================
// API Routes
// ===============================
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

// ===============================
// Server Health Check
// ===============================
app.get('/api/up', (req, res) => {
  res.json({
    success: true,
    message: 'Gulf Coast Music API is UP!',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Gulf Coast Music Backend',
    version: '1.0.0',
    environment: NODE_ENV,
  });
});

// ===============================
// Error Handler
// ===============================
app.use(errorHandler);

// ===============================
// Start Server
// ===============================
// const server = app.listen(PORT, () => {
//   console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
// });

// export default server;


//added for vercel hosting
export default app;
