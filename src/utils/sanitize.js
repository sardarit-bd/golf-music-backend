export const sanitizeVenueForPlan = (venue, rules) => {
  const venueObj = venue.toObject ? venue.toObject() : { ...venue };
  
  const sanitized = {
    ...venueObj,
    // NEW: Include state
    state: venueObj.state,
    city: venueObj.city,
    venueName: venueObj.venueName,
    address: rules.address ? venueObj.address : undefined,
    seatingCapacity: rules.seatingCapacity ? venueObj.seatingCapacity : undefined,
    biography: rules.biography ? venueObj.biography : undefined,
    openHours: rules.openHours ? venueObj.openHours : undefined,
    openDays: rules.openHours ? venueObj.openDays : undefined,
    phone: venueObj.phone || undefined,
    website: venueObj.website || undefined,
    photos: rules.photos > 0 
      ? (venueObj.photos || []).slice(0, rules.photos) 
      : undefined,
    colorCode: venueObj.colorCode,
    verifiedOrder: venueObj.verifiedOrder,
    isActive: venueObj.isActive,
    createdAt: venueObj.createdAt,
    updatedAt: venueObj.updatedAt,
    featuresLocked: venueObj.featuresLocked,
    showLimit: venueObj.showLimit,
    photosLimit: venueObj.photosLimit,
  };

  // Remove undefined fields
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });

  return sanitized;
};