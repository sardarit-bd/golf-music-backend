export const SUBSCRIPTION_RULES = {
  venue: {
    free: {
      photos: 0,
      biography: false,
      openHours: false,
      address: false,
      seatingCapacity: false,
      shows: 1,
      marketFeePercent: 10,
    },
    pro: {
      photos: 5,
      biography: true,
      openHours: true,
      address: true,
      seatingCapacity: true,
      shows: Infinity,
      marketFeePercent: 5,
      trialDays: 30,
    },
  },

  artist: {
    free: {
      photos: 0,
      mp3: 0,
      biography: false,
      marketFeePercent: 10,
    },
    pro: {
      photos: 5,
      mp3: 1,
      biography: true,
      marketFeePercent: 5,
      trialDays: 30,
    },
  },
};
