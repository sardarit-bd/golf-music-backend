import Venue from "../models/model.venue.js";


export const buildVenueUpdateData = ({ body, venue, rules, mergedPhotos }) => {
  // only update fields that plan allows; otherwise keep existing
  return {
    venueName: body.venueName ?? Venue.venueName,
    city: (body.city ?? venue.city).toLowerCase(),

    address: rules.address ? (body.address ?? venue.address) : venue.address,

    seatingCapacity: rules.seatingCapacity
      ? Number.parseInt(body.seatingCapacity ?? venue.seatingCapacity ?? "0")
      : venue.seatingCapacity,

    biography: rules.biography ? (body.biography ?? venue.biography) : venue.biography,
    openHours: rules.openHours ? (body.openHours ?? venue.openHours) : venue.openHours,
    openDays: rules.openHours ? (body.openDays ?? venue.openDays) : venue.openDays,

    // photos only if allowed; else keep existing photos (IMPORTANT)
    photos: rules.photos > 0 ? mergedPhotos : venue.photos,

    photosLimit: rules.photos,
    showLimit: Number.isFinite(rules.shows) ? rules.shows : venue.showLimit,

    featuresLocked: !(
      rules.biography ||
      rules.openHours ||
      rules.photos > 0 ||
      rules.address ||
      rules.seatingCapacity
    ),

    updatedAt: Date.now(),
  };
};
