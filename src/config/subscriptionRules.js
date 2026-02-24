import { SUBSCRIPTION_CONFIG } from "./SUBSCRIPTION_CONFIG.js";


const getRules = (userType) => {

  const isFeatureEnabled =
    SUBSCRIPTION_CONFIG.FEATURE_SUBSCRIPTION
      .ENABLE_FEATURE_SUBSCRIPTIONS;

  // ====================== FREE RULES ======================
  const freeRules = {

    venue: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      biography: true,
      openHours: true,
      address: true,
      seatingCapacity: true,
      shows: SUBSCRIPTION_CONFIG.FEATURES.MAX_SHOWS_PER_MONTH.free,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    artist: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      mp3: SUBSCRIPTION_CONFIG.FEATURES.MAX_MP3.free,
      biography: true,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    photographer: {
      biography: true,
      services: true,
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      videos: SUBSCRIPTION_CONFIG.FEATURES.MAX_VIDEOS.free,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    studio: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      audioFiles: 1,
      biography: true,
      services: true,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    journalist: {
      biography: true,
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.free,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    fan: {
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },
  };

  // ====================== PRO RULES ======================
  const proRules = {

    venue: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      biography: true,
      openHours: true,
      address: true,
      seatingCapacity: true,
      shows: SUBSCRIPTION_CONFIG.FEATURES.MAX_SHOWS_PER_MONTH.pro,
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      prioritySupport: true,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    artist: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      mp3: SUBSCRIPTION_CONFIG.FEATURES.MAX_MP3.pro,
      biography: true,
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      unlimitedMusicVideos: true,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    photographer: {
      biography: true,
      services: true,
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      videos: SUBSCRIPTION_CONFIG.FEATURES.MAX_VIDEOS.pro,
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      priorityListing: true,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    studio: {
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      audioFiles: 1,
      biography: true,
      services: true,
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      priorityListing: true,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    journalist: {
      biography: true,
      photos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS.pro,
      analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
      priorityListing: true,
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },

    fan: {
      locationCategorization: true,
      stateVisibility: true,
      cityVisibility: true,
    },
  };

  return {
    free: freeRules[userType] || freeRules.venue,
    pro: isFeatureEnabled
      ? (proRules[userType] || proRules.venue)
      : (freeRules[userType] || freeRules.venue),
  };
};


// Export rules
export const SUBSCRIPTION_RULES = {
  venue: getRules("venue"),
  artist: getRules("artist"),
  photographer: getRules("photographer"),
  studio: getRules("studio"),
  journalist: getRules("journalist"),
  fan: getRules("fan"),
};