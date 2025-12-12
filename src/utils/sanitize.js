


export const sanitizeVenueForPlan = (venueDoc, rules) => {
  const v = venueDoc.toObject ? venueDoc.toObject() : { ...venueDoc };

  const hiddenPhotosCount = (v.photos?.length || 0);

  return {
    ...v,

    // Pro-only fields masked on free
    biography: rules.biography ? v.biography : "",
    openHours: rules.openHours ? v.openHours : "",
    openDays: rules.openHours ? v.openDays : "",

    // Photos hidden on free
    photos: rules.photos > 0 ? v.photos : [],

    // Metadata for UI
    _entitlements: {
      plan: rules ? true : false,
      locked: {
        biography: !rules.biography,
        openHours: !rules.openHours,
        photos: rules.photos === 0,
      },
      hiddenCounts: {
        photos: rules.photos > 0 ? 0 : hiddenPhotosCount,
      },
      limits: {
        photos: rules.photos,
        shows: rules.shows,
      },
    },
  };
};
