# 📚 Gulf Coast Music API - Endpoint Documentation

This document provides a comprehensive reference of all API endpoints available on the Gulf Coast Music backend service.

---

## 🌐 Base URL & Conventions
- **Development**: `http://localhost:5000`
- **Production**: Configured via `CLIENT_URL` / domain
- **Authentication**: JWT Bearer token sent in `Authorization` header:
  ```http
  Authorization: Bearer <your_jwt_token>
  ```
- **Standard Response Format**:
  ```json
  {
    "success": true,
    "message": "Operation successful",
    "data": { ... }
  }
  ```
- **Standard Error Response Format**:
  ```json
  {
    "success": false,
    "message": "Error description",
    "errors": {
      "details": [ ... ]
    }
  }
  ```

---

## 1. System & Health
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Public | Root endpoint returning API version & environment info |
| `GET` | `/api/up` | Public | Healthcheck endpoint returning liveness & timestamp |
| `POST` | `/api/stripe/webhook` | Stripe Only | Stripe webhook receiver (verifies `stripe-signature`) |

---

## 2. Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new user account (`artist`, `venue`, `journalist`, `photographer`, `studio`, `fan`) |
| `POST` | `/api/auth/login` | Public | User authentication returning JWT token & profile |
| `POST` | `/api/auth/forgot-password` | Public | Initiates password reset flow and emails 15-minute token |
| `PUT` | `/api/auth/reset-password/:token`| Public | Sets new password using verification token |
| `GET` | `/api/auth/me` | Protected | Returns authenticated user details and active subscription |
| `PUT` | `/api/auth/profile` | Protected | Updates basic user profile (state, city, genre) |
| `GET` | `/api/auth/by-location` | Protected | Fetches users filtered by state, city, and userType |

---

## 3. Administrator Dashboard (`/api/admin`)
*All admin routes require `protect` and `authorize('admin')`.*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/profile` | Fetch admin profile details |
| `PUT` | `/api/admin/profile` | Update admin profile details & profile photo |
| `PUT` | `/api/admin/profile/change-password` | Change admin account password |
| `GET` | `/api/admin/dashboard` | Dashboard overview statistics (users, venues, events, news counts) |
| `POST` | `/api/admin/users/:id/promote` | Promote a user to admin role |
| `GET` | `/api/admin/users` | List all system users with filters & pagination |
| `PUT` | `/api/admin/users/:id/verify` | Verify and activate a user account |
| `PUT` | `/api/admin/users/:id` | Update user details by admin |
| `DELETE` | `/api/admin/users/:id` | Delete user account and associated profile |
| `GET` | `/api/admin/content` | List moderation content across entities |
| `PUT` | `/api/admin/content/:type/:id/toggle` | Toggle active status of content item |
| `GET` | `/api/admin/news` | List all news articles for admin |
| `PUT` | `/api/admin/news/:id` | Edit news article by admin |
| `PUT` | `/api/admin/news/:id/toggle` | Toggle active status of news article |
| `DELETE` | `/api/admin/news/:id` | Delete news article by admin |
| `GET` | `/api/admin/contacts` | List customer contact form submissions |
| `PUT` | `/api/admin/contacts/:id/read` | Mark contact inquiry as read |
| `DELETE` | `/api/admin/contacts/:id` | Delete contact inquiry |

---

## 4. Artists (`/api/artists`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/artists` | Public | List active artists filtered by genre, state, and city |
| `GET` | `/api/artists/:id` | Public | Get single artist profile details |
| `GET` | `/api/artists/profile/me` | Artist | Get authenticated artist's own profile |
| `POST` | `/api/artists/profile` | Artist | Create or update artist profile (photos, MP3, bio) |
| `DELETE` | `/api/artists/profile` | Artist | Delete authenticated artist's profile |
| `GET` | `/api/artists/admin/artists` | Admin | List all artists with admin filters *(see route ordering note)* |
| `PUT` | `/api/artists/admin/:id` | Admin | Update artist details by admin |
| `PUT` | `/api/artists/admin/:id/plan` | Admin | Update artist subscription plan override |
| `DELETE` | `/api/artists/admin/:id` | Admin | Delete artist profile by admin |

---

## 5. Venues (`/api/venues`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/venues` | Public | List venues filtered by city |
| `GET` | `/api/venues/:id` | Public | Get single venue details |
| `GET` | `/api/venues/calendar` | Public | Get venue event calendar by city |
| `GET` | `/api/venues/by-state` | Public | Grouped venues by state |
| `GET` | `/api/venues/states-summary` | Public | Summary metrics by state |
| `GET` | `/api/venues/subscription/status` | Protected | Current subscription limits and rules |
| `GET` | `/api/venues/profile` | Venue | Authenticated venue's profile |
| `POST` | `/api/venues/profile` | Venue | Create/update venue profile with photos |
| `PUT` | `/api/venues/profile` | Venue | Explicit update for venue profile |
| `DELETE` | `/api/venues/profile` | Venue | Delete venue profile |
| `POST` | `/api/venues/add-show` | Venue | Create new show/event for venue |
| `GET` | `/api/venues/shows` | Venue | List shows created by venue |
| `GET` | `/api/venues/shows/count` | Venue | Count shows created in current billing month |
| `GET` | `/api/venues/shows/:showId` | Venue | Single show details |
| `PUT` | `/api/venues/shows/:showId` | Venue | Update show details/image |
| `DELETE` | `/api/venues/shows/:showId` | Venue | Delete show |
| `DELETE` | `/api/venues/shows/bulk` | Venue | Bulk delete multiple shows |
| `GET` | `/api/venues/admin/colors/available` | Admin | Available color codes for city *(see route ordering note)* |
| `GET` | `/api/venues/admin/venues` | Admin | List all venues for admin *(see route ordering note)* |
| `PUT` | `/api/venues/admin/:id` | Admin | Update venue and assign color code |
| `DELETE` | `/api/venues/admin/:id` | Admin | Delete venue by admin |

---

## 6. Events & Calendar (`/api/events`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/events` | Public | Events list by city |
| `GET` | `/api/events/calendar` | Public | Full calendar events |
| `GET` | `/api/events/state-city` | Public | Events filtered by state and city |
| `GET` | `/api/events/upcoming` | Public | Upcoming active events |
| `GET` | `/api/events/:id` | Public | Single event details |
| `POST` | `/api/events` | Venue | Create event by venue |
| `PUT` | `/api/events/:id` | Venue | Update event by venue |
| `DELETE` | `/api/events/:id` | Venue | Delete event by venue |
| `GET` | `/api/events/venue/my-events` | Venue | All events for current venue |
| `POST` | `/api/events/admin` | Admin | Create event directly as admin |
| `GET` | `/api/events/admin/events` | Admin | List all events for admin *(see route ordering note)* |
| `PUT` | `/api/events/admin/:id` | Admin | Update event by admin |
| `PUT` | `/api/events/admin/:id/toggle` | Admin | Toggle event active status |
| `DELETE` | `/api/events/admin/:id` | Admin | Delete event by admin |
| `GET` | `/api/events/admin/venue/:venueId/events` | Admin | Events for specific venue *(see route ordering note)* |
| `PUT` | `/api/events/admin/venue/:venueId/bulk-update-colors` | Admin | Bulk synchronize event colors to venue |

---

## 7. Journalists & News (`/api/journalists`, `/api/news`)
### Journalists
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/journalists` | Public | List all active journalists |
| `GET` | `/api/journalists/location` | Public | Journalists filtered by location |
| `GET` | `/api/journalists/:id` | Public | Single journalist details |
| `GET` | `/api/journalists/profile` | Journalist | Get own journalist profile |
| `POST` | `/api/journalists/profile` | Journalist | Create or update profile |
| `PUT` | `/api/journalists/profile` | Journalist | Update journalist profile |
| `DELETE` | `/api/journalists/profile` | Journalist | Delete journalist profile |
| `GET` | `/api/journalists/admin/journalists` | Admin | List journalists for admin *(see route ordering note)* |
| `PUT` | `/api/journalists/:id/verify` | Admin | Verify journalist account |

### News
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/news` | Public | News articles filtered by location |
| `GET` | `/api/news/featured` | Public | Featured articles |
| `GET` | `/api/news/search` | Public | Search news by keywords |
| `GET` | `/api/news/stats` | Public | News statistics |
| `GET` | `/api/news/:id` | Public | Single news article details |
| `GET` | `/api/news/journalist/my-news`| Journalist | Articles published by logged-in journalist |
| `POST` | `/api/news` | Journalist | Create news article with photo attachments |
| `PUT` | `/api/news/:id` | Journalist | Update news article |
| `DELETE` | `/api/news/:id` | Journalist | Delete news article |

---

## 8. Photographers & Videographers (`/api/photographers`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/photographers` | Public | List all active photographers |
| `GET` | `/api/photographers/:id` | Public | Single photographer profile |
| `GET` | `/api/photographers/profile` | Photographer | Own profile |
| `POST` | `/api/photographers/profile` | Protected | Create photographer profile |
| `PUT` | `/api/photographers/profile` | Photographer | Update profile |
| `POST` | `/api/photographers/services` | Photographer | Add service package |
| `PUT` | `/api/photographers/services/:serviceId`| Photographer | Update service package |
| `DELETE` | `/api/photographers/services/:serviceId`| Photographer | Remove service package |
| `POST` | `/api/photographers/photos` | Photographer | Upload portfolio photos |
| `DELETE` | `/api/photographers/photos/:photoId` | Photographer | Delete portfolio photo |
| `POST` | `/api/photographers/videos` | Photographer | Add portfolio video |
| `PUT` | `/api/photographers/videos/:videoId` | Photographer | Update portfolio video |
| `DELETE` | `/api/photographers/videos/:videoId` | Photographer | Delete portfolio video |
| `GET` | `/api/photographers/admin/photographers` | Admin | List all photographers *(see route ordering note)* |
| `PUT` | `/api/photographers/admin/:id/plan` | Admin | Change subscription plan override |
| `PUT` | `/api/photographers/photographers/:id/toggle` | Admin | Toggle activation status |
| `DELETE` | `/api/photographers/photographers/:id` | Admin | Delete photographer |

---

## 9. Studios (`/api/studios`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/studios/location` | Public | Studios filtered by state & city |
| `GET` | `/api/studios/public/:id` | Public | Public studio profile |
| `GET` | `/api/studios/profile` | Studio | Authenticated studio profile |
| `PUT` | `/api/studios/profile` | Studio | Update studio profile |
| `PUT` | `/api/studios/services` | Studio | Update studio services |
| `POST` | `/api/studios/photos` | Studio | Upload gallery photos (up to 5) |
| `POST` | `/api/studios/audio` | Studio | Upload studio audio demo sample |
| `DELETE` | `/api/studios/photos/:photoId` | Studio | Delete gallery photo |
| `DELETE` | `/api/studios/audio` | Studio | Remove audio demo sample |
| `GET` | `/api/studios/admin/all` | Admin | List all studios |
| `GET` | `/api/studios/admin/:id` | Admin | Get studio details for admin |
| `PUT` | `/api/studios/admin/status/:id` | Admin | Toggle verified / active status |
| `DELETE` | `/api/studios/admin/:id` | Admin | Delete studio by admin |

---

## 10. Marketplace & Analytics (`/api/market`, `/api/market-checkout`, `/api/market-analytics`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/market` | Public | Browse active marketplace listings |
| `GET` | `/api/market/my-listing` | Protected | Authenticated user's single marketplace listing |
| `GET` | `/api/market/:id` | Public/Owner | View listing details (owners can view pending items) |
| `POST` | `/api/market` | Protected | Create marketplace listing (photos & optional videos) |
| `PUT` | `/api/market` | Protected | Update marketplace listing |
| `DELETE` | `/api/market` | Protected | Delete marketplace listing and media files |
| `POST` | `/api/market-checkout/create-checkout-session` | Protected | Create Stripe Checkout session for listing purchase |
| `GET` | `/api/market-checkout/order/:orderId` | Protected | Fetch order status post-purchase |
| `GET` | `/api/market-analytics` | Protected | Seller sales analytics and revenue metrics |

---

## 11. Merch & Merchandise Orders (`/api/merch`, `/api/orders`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/merch` | Public | Browse available merchandise |
| `GET` | `/api/merch/:id` | Public | Single merchandise item |
| `POST` | `/api/merch` | Admin | Create merchandise item |
| `PUT` | `/api/merch/:id` | Admin | Update merchandise item |
| `DELETE` | `/api/merch/:id` | Admin | Delete merchandise item |
| `POST` | `/api/orders` | Protected | Create merchandise order (Stripe or COD) |
| `GET` | `/api/orders/my-orders` | Protected | Buyer's past orders |
| `GET` | `/api/orders/:id` | Protected | Single order details |
| `GET` | `/api/orders/admin/all` | Admin | List all orders with status filter & pagination |
| `PUT` | `/api/orders/:id/status` | Admin | Update shipping/delivery status |

---

## 12. Stripe Connect & Subscriptions (`/api/stripe`, `/api/subscription`)
### Stripe Connect (Sellers)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/stripe/connect/status` | Protected | Check Stripe Connect account status (`active`, `pending`, `not_connected`) |
| `POST` | `/api/stripe/connect/onboard` | Protected | Generate Stripe Express onboarding URL |
| `GET` | `/api/stripe/connect/dashboard` | Protected | Generate Stripe Express login portal link |
| `GET` | `/api/stripe/connect/refresh` | Protected | Refresh onboarding link if expired |
| `GET` | `/api/stripe/connect/success` | Protected | Finalize Stripe Connect onboarding callback |
| `POST` | `/api/stripe/connect/disconnect` | Protected | Disconnect Stripe account |

### Subscriptions (Pro Plan)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/subscription/status` | Protected | Check Pro subscription status & trial period |
| `POST` | `/api/subscription/checkout` | Protected | Create Stripe subscription checkout session ($10/month) |
| `POST` | `/api/subscription/cancel` | Protected | Cancel active Pro subscription |
| `POST` | `/api/subscription/portal` | Protected | Create Stripe billing customer portal session |

---

## 13. Miscellaneous & CMS Content
| Group | Method | Endpoint | Access | Description |
|---|---|---|---|---|
| **Casts** | `GET` | `/api/casts` | Public | Browse video casts |
| **Casts** | `POST` | `/api/casts` | Admin | Create cast entry |
| **Waves** | `GET` | `/api/waves` | Public | Browse audio waves |
| **Waves** | `POST` | `/api/waves` | Admin | Create wave entry |
| **Hero** | `GET` | `/api/hero` | Public | Get active hero video |
| **Hero** | `PUT` | `/api/hero` | Admin | Update hero video |
| **Hero** | `GET` | `/api/hero/upload-signature` | Admin | Cloudinary direct upload signature |
| **Sponsors** | `GET` | `/api/sponsors` | Public | Get active sponsor banners |
| **Footer** | `GET` | `/api/footer` | Public | Get footer navigation links & socials |
| **Featured** | `GET` | `/api/featured-section` | Public | Featured section content |
| **Contact** | `POST` | `/api/contact` | Public | Submit website contact form |
