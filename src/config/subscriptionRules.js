// export const SUBSCRIPTION_RULES = {

import { SUBSCRIPTION_CONFIG } from "./SUBSCRIPTION_CONFIG.js";

// ======================
// VENUE PROFILES
// ======================
// venue: {
//   free: {
//     photos: 5,
//     biography: true,
//     openHours: true,
//     address: true,
//     seatingCapacity: true,
//     shows: 5,
//     marketFeePercent: 0,
//   },
//   pro: {
//     photos: 5,
//     biography: true,
//     openHours: true,
//     address: true,
//     seatingCapacity: true,
//     shows: 5,
//     marketFeePercent: 0,
//   },
// },

// ======================
// ARTIST PROFILES
// ======================
// artist: {
//   free: {
//     photos: 5,
//     mp3: 5,
//     biography: true,
//     marketFeePercent: 0,
//   },
//   pro: {
//     photos: 5,
//     mp3: 5,
//     biography: true,
//     marketFeePercent: 0,
//   },
// },

// ======================
// PHOTOGRAPHER / CAMERAS
// ======================
//   photographer: {
//     free: {
//       biography: true,
//       services: true,
//       photos: 5,
//       videos: 5,
//       marketFeePercent: 0,
//     },
//     pro: {
//       biography: true,
//       services: true,
//       photos: 5,
//       videos: 5,
//       marketFeePercent: 0,
//     },
//   },

// };

// Helper function to get rules based on config
const getRules = (userType) => {
  const isProEnabled = SUBSCRIPTION_CONFIG.SYSTEM_WIDE.ENABLE_SUBSCRIPTIONS;

  const freeRules = {
    // ====================== VENUE ======================
    venue: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      biography: true,
      openHours: true,
      address: true,
      seatingCapacity: true,
      shows: SUBSCRIPTION_CONFIG.FEATURES.MAX_SHOWS_PER_MONTH.free,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.free,
      // Location-based categorization (ALWAYS ENABLED)
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    // ====================== ARTIST ======================
    artist: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      mp3: SUBSCRIPTION_CONFIG.FEATURES.MAX_MP3.free,
      biography: true,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.free,
      // Location-based categorization (ALWAYS ENABLED)
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    // ====================== PHOTOGRAPHER ======================
    photographer: {
      biography: true,
      services: true,
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      videos: SUBSCRIPTION_CONFIG.FEATURES.MAX_VIDEOS.free,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.free,
      // Location-based categorization (ALWAYS ENABLED)
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },


    // ====================== STUDIO ======================
    studio: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      audioFiles: 1,
      biography: true,
      services: true,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.free,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

  };

  const proRules = {
    // ====================== VENUE PRO ======================
    venue: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      biography: true,
      openHours: true,
      address: true,
      seatingCapacity: true,
      shows: SUBSCRIPTION_CONFIG.FEATURES.MAX_SHOWS_PER_MONTH.pro,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.pro,
      trialDays: SUBSCRIPTION_CONFIG.PRICING.TRIAL_DAYS,
      // Advanced features (only if enabled in config)
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      advancedAnalytics: true,
      prioritySupport: true,
      customDomain: true,
      // Location-based categorization (ALWAYS ENABLED)
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    // ====================== ARTIST PRO ======================
    artist: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      mp3: SUBSCRIPTION_CONFIG.FEATURES.MAX_MP3.pro,
      biography: true,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.pro,
      trialDays: SUBSCRIPTION_CONFIG.PRICING.TRIAL_DAYS,
      // Advanced features
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      unlimitedMusicVideos: true,
      customStore: true,
      // Location-based categorization (ALWAYS ENABLED)
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    // ====================== PHOTOGRAPHER PRO ======================
    photographer: {
      biography: true,
      services: true,
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      videos: SUBSCRIPTION_CONFIG.FEATURES.MAX_VIDEOS.pro,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.pro,
      trialDays: SUBSCRIPTION_CONFIG.PRICING.TRIAL_DAYS,
      // Advanced features
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      unlimitedPhotos: true,
      priorityListing: true,
      // Location-based categorization (ALWAYS ENABLED)
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    // ====================== STUDIO PRO ======================
    studio: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      audioFiles: 1,
      biography: true,
      services: true,
      marketFeePercent: SUBSCRIPTION_CONFIG.FEATURES.MARKETPLACE_FEE.pro,
      trialDays: SUBSCRIPTION_CONFIG.PRICING.TRIAL_DAYS,
      // Advanced features
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      priorityListing: true,
      // Location-based categorization (ALWAYS ENABLED)
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },
  };

  return {
    free: freeRules[userType] || freeRules.venue, // fallback
    pro: isProEnabled ? (proRules[userType] || proRules.venue) : freeRules[userType]
  };
};

// Dynamic subscription rules based on config
export const SUBSCRIPTION_RULES = {
  venue: getRules('venue'),
  artist: getRules('artist'),
  photographer: getRules('photographer'),
  studio: getRules('studio'),
  journalist: getRules('journalist'),
  fan: getRules('fan'),
};