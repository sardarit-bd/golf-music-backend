# 🎵 Gulf Coast Music API

Comprehensive backend service and RESTful API powering the **Gulf Coast Music** platform — a music discovery, artist dashboard, venue scheduling, marketplace, and subscriber management ecosystem covering the Gulf Coast region (Louisiana, Mississippi, Alabama, and Florida).

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Technology Stack](#-technology-stack)
3. [System Architecture](#-system-architecture)
4. [Prerequisites](#-prerequisites)
5. [Installation & Local Setup](#-installation--local-setup)
6. [Environment Configuration](#-environment-configuration)
7. [Database Setup & Seeding](#-database-setup--seeding)
8. [Third-Party Integrations](#-third-party-integrations)
   - [MongoDB Atlas](#mongodb-atlas)
   - [Cloudinary Media Storage](#cloudinary-media-storage)
   - [Stripe Payments, Connect & Subscriptions](#stripe-payments-connect--subscriptions)
   - [Email Service (Nodemailer / SMTP)](#email-service-nodemailer--smtp)
9. [Development & Available Scripts](#-development--available-scripts)
10. [Production Deployment](#-production-deployment)
    - [Option A: Linux VPS with PM2 & Nginx (Recommended)](#option-a-linux-vps-with-pm2--nginx-recommended)
    - [Option B: Serverless / Vercel](#option-b-serverless--vercel)
11. [API Documentation](#-api-documentation)
12. [Known Issues & Audit Findings](#-known-issues--audit-findings)
13. [Handover Checklist](#-handover-checklist)

---

## 🌟 Project Overview

The Gulf Coast Music backend provides a unified, role-based backend for 7 user categories:
- **Admin**: Full platform management, user verification, moderation, CMS management, and analytics.
- **Artist**: Profile management, MP3 music uploads, photo galleries, and marketplace listings.
- **Venue**: Profile customization, automated color palette assignment by city, show creation, and monthly quota limits.
- **Journalist**: Press articles, news publishing, and regional coverage tags.
- **Photographer / Videographer**: Portfolio galleries, service packages, and promotional video showcases.
- **Studio**: Music recording studio profiles, audio samples, and client booking links.
- **Fan / Subscriber**: Music streaming, merchandise purchasing, and marketplace buying.

---

## 🧱 Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Runtime** | Node.js (v18, v20, or v22 LTS) | Server-side JavaScript runtime (ES Modules) |
| **Web Framework** | Express.js 5.x | High-performance HTTP server & router |
| **Database** | MongoDB & Mongoose 8.x | Document database & Object Data Modeling (ODM) |
| **Authentication** | JWT (`jsonwebtoken`) & `bcryptjs` | Stateless token authorization & password hashing |
| **File Storage** | Cloudinary & `multer` | Cloud media storage for photos, MP3 audio, and videos |
| **Payments** | Stripe API 19.x | Stripe Checkout, Recurring Billing ($10/mo), & Stripe Connect |
| **Email** | Nodemailer | SMTP transaction emails (verification, reset, orders) |
| **Security** | Helmet, Express Rate Limit, CORS | HTTP security headers, throttling, and origin control |
| **Process Manager** | PM2 | Production cluster management & daemonization |

---

## 📋 Prerequisites

Before setting up the project, ensure you have:
- **Node.js**: `v18.0.0` or higher (`v20 LTS` or `v22 LTS` recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB**: A running local MongoDB instance or a free/paid MongoDB Atlas cluster
- Accounts on:
  - [Cloudinary](https://cloudinary.com)
  - [Stripe](https://stripe.com)
  - [Google Account / SMTP Server](https://myaccount.google.com) (for emails)

---

## 🚀 Installation & Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/sardarit-bd/golf-music-backend.git
cd golf-music-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment configuration
Copy the template configuration file:
```bash
cp .env.example .env
```
Open `.env` in your editor and configure the keys with your actual values (see details below).

### 4. Seed the database
Populate the state and city mapping along with the pre-assigned city color codes:
```bash
npm run seed:statecities
```
*(Optional)* Seed the initial Super Administrator account:
```bash
npm run seed:admin
```

### 5. Start the server
```bash
# Start in development mode with nodemon auto-reload:
npm run dev

# Or start in production mode:
npm start
```
The server will start listening on port `5000` (or `PORT` defined in `.env`). You can verify health via:
```bash
curl http://localhost:5000/api/up
```

---

## ⚙️ Environment Configuration

All environment variables are declared in [`.env.example`](file:///.env.example). Create a local `.env` file in the root directory:

```bash
# --------------------------------------------------------
# Server
# --------------------------------------------------------
NODE_ENV=development
PORT=5000

# --------------------------------------------------------
# Database
# --------------------------------------------------------
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/GulfCoast?retryWrites=true&w=majority

# --------------------------------------------------------
# Authentication
# --------------------------------------------------------
JWT_SECRET=your_super_secret_random_64_character_key
JWT_EXPIRE=7d

# --------------------------------------------------------
# Frontend Application URLs
# --------------------------------------------------------
CLIENT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# --------------------------------------------------------
# Email Service
# --------------------------------------------------------
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_16_character_app_password
SMTP_EMAIL=your_email@gmail.com

# --------------------------------------------------------
# Cloudinary (Media Hosting)
# --------------------------------------------------------
CLOUDINARY_NAME=your_cloud_name
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# --------------------------------------------------------
# Stripe (Payments, Subscriptions & Connect)
# --------------------------------------------------------
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
```

---

## 🗄️ Database Setup & Seeding

The application requires MongoDB collections initialized with valid Gulf Coast cities and colors:

### State & City Seeding
The system includes an automated script that loads the four supported states (Louisiana, Mississippi, Alabama, Florida), their respective regional cities, and precomputed color hex palettes for venues:
```bash
npm run seed:statecities
```

### Administrator Seeding
To initialize the default Super Admin user:
```bash
npm run seed:admin
```
*Note: Make sure to change the admin password upon initial login in the admin dashboard.*

---

## 🔌 Third-Party Integrations

### MongoDB Atlas
1. Create a cluster on [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a database user with read and write permissions.
3. Whitelist your server IP address (or `0.0.0.0/0` with secure credentials).
4. Copy the connection string to `MONGODB_URI` in `.env`.

### Cloudinary Media Storage
1. Sign in to your [Cloudinary Console](https://cloudinary.com).
2. Copy the **Cloud Name**, **API Key**, and **API Secret** from Dashboard.
3. Add them to `.env` as `CLOUDINARY_NAME`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
4. Ensure upload settings allow raw video and audio uploads.

### Stripe Payments, Connect & Subscriptions
The platform integrates 3 distinct Stripe features:
1. **Subscriptions (Pro Plan)**:
   - Create a Recurring Product in your Stripe Dashboard named "Pro Plan" priced at `$10.00/month`.
   - Copy the `price_...` ID and paste it into `STRIPE_PRICE_PRO` in `.env`.
2. **Stripe Connect (Marketplace Payouts)**:
   - Enable **Stripe Connect** under Stripe Dashboard -> Connect Settings.
   - Choose **Express** onboarding.
   - Set the Redirect URLs to point to your frontend (`/stripe/refresh` and `/stripe/success`).
3. **Stripe Webhooks**:
   - Go to Stripe Dashboard -> Developers -> Webhooks.
   - Add an endpoint pointing to: `https://<your-backend-domain>/api/stripe/webhook`.
   - Select the following events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `account.updated`
   - Copy the Signing Secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` in `.env`.

### Email Service (Nodemailer / SMTP)
- By default, Gmail SMTP is used (`EMAIL_SERVICE=gmail`).
- Generate an App Password via Google Account -> Security -> 2-Step Verification -> App Passwords.
- Paste the 16-character password into `EMAIL_PASSWORD`.

---

## 💻 Development & Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts server in development mode with nodemon watching file changes |
| `npm start` | Runs server directly using Node.js |
| `npm run seed:statecities` | Seeds states, cities, and color palettes into MongoDB |
| `npm run seed:admin` | Seeds initial Super Admin account |
| `npm test` | Runs Jest test suite |

---

## 🚢 Production Deployment

### Option A: Linux VPS with PM2 & Nginx (Recommended)

#### 1. Server Preparation (Ubuntu 22.04 LTS / 24.04 LTS)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

#### 2. Project Setup
```bash
git clone https://github.com/sardarit-bd/golf-music-backend.git /var/www/golf-music-backend
cd /var/www/golf-music-backend
npm install --production
cp .env.example .env
nano .env # configure production secrets
```

#### 3. Run with PM2
An [`ecosystem.config.cjs`](file:///ecosystem.config.cjs) file is included in the root directory:
```bash
# Start cluster
pm2 start ecosystem.config.cjs --env production

# Save process list and enable on system boot
pm2 save
pm2 startup
```

#### 4. Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/api.gulfcoastmusic.live`:
```nginx
server {
    listen 80;
    server_name api.gulfcoastmusic.live;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable site and acquire SSL via Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/api.gulfcoastmusic.live /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.gulfcoastmusic.live
```

---

### Option B: Serverless / Vercel

The repository includes a `vercel.json` and `api/index.js` file. Note that:
- Serverless environments have maximum execution timeouts and cannot run long background tasks.
- If using Vercel, ensure `src/server.js` exports the Express `app` instance instead of `server.listen()`.

---

## 📖 API Documentation

A detailed list of all 100+ endpoints, HTTP methods, access requirements, and payload descriptions is available in:
👉 [**API_ENDPOINTS.md**](file:///API_ENDPOINTS.md)

---

## ⚠️ Known Issues & Audit Findings

During the backend audit conducted prior to client handover, the following issues were identified:

1. **Express Route Shadowing (`/:id` matching `/admin/*`)**:
   - In `src/routes/router.artists.js`, `src/routes/router.venue.js`, `src/routes/router.events.js`, `src/routes/router.journalists.js`, and `src/routes/routes.photographer.js`, generic parameterized routes (e.g. `GET /:id`) were defined *above* specific administrative routes (e.g. `GET /admin/artists`, `GET /admin/venues`, `GET /admin/events`). As a result, requests to `/admin/...` are caught by `/:id` with `id="admin"`, triggering a MongoDB CastError.
   - **Fix**: Move all static `/admin/...` subroutes *before* dynamic `/:id` routes.
2. **Environment Variable Naming Inconsistencies**:
   - Cloudinary cloud name is called `CLOUDINARY_NAME` in `.env` and `src/config/environment.js`, but referenced as `CLOUDINARY_CLOUD_NAME` in `src/controllers/controller.cast.js` and `src/controllers/controller.heroSection.js`. Both keys are documented in `.env.example`.
   - In `src/utils/emailService.js`, the sender email for password reset references `process.env.SMTP_EMAIL`, whereas all other functions reference `EMAIL_USERNAME`.
3. **`seedAdmin.js` Git Exclusion**:
   - `src/utils/seedAdmin.js` was listed in `.gitignore`. A fresh `git clone` will miss this file unless tracked or unignored.
4. **Hardcoded Admin Email in Notifications**:
   - In `src/utils/emailService.js`, recipient email `thegulfcoastmusic@gmail.com` is hardcoded. It should be parameterized via `ADMIN_NOTIFICATION_EMAIL`.
5. **Vercel Serverless Export Conflict**:
   - `src/server.js` exports the `http.Server` instance (`export default server;`), but `api/index.js` expects the Express `app` instance.
6. **Redundant / Dead Controller Files**:
   - `src/controllers/controller.merchWebhook.js`, `src/controllers/controller.subscriptionWebhook.js`, and `src/controllers/controller.webhook.js` are unreferenced remnants, as webhook handling is now consolidated in `src/controllers/controller.stripeWebhook.js`.
   - `src/middleware/subscriptionMiddleware.js` and `src/middleware/checkTrialStatus.js` are unreferenced.

---

## ✅ Handover Checklist

- [x] **Source Code Ready**: Entire backend codebase reviewed, dependencies cataloged, and entry points verified.
- [x] **Environment Template Ready**: Complete `.env.example` created with all required keys, sanitized descriptions, and no sensitive credentials.
- [x] **Documentation Ready**: Thorough `README.md` and complete `API_ENDPOINTS.md` prepared.
- [x] **Database Setup Documented**: MongoDB connection parameters, Mongoose schemas, and state/city seed commands detailed.
- [x] **Deployment Steps Documented**: Step-by-step instructions for Ubuntu VPS, PM2 cluster, Nginx reverse proxy, and SSL setup provided.
- [x] **PM2 Ecosystem Configured**: Production `ecosystem.config.cjs` provided.
- [x] **External Services Documented**: Cloudinary, Stripe (Payments, Subscriptions, Connect), and Nodemailer setup steps mapped out.
- [x] **Known Issues Cataloged**: Architectural quirks, route shadowing, and recommended fixes thoroughly documented for client engineers.
