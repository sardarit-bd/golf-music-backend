export const sanitizePhotographerForPlan = (doc, rules) => {
  const p = doc?.toObject ? doc.toObject() : { ...doc };

  const hidden = {
    photos: p.photos?.length || 0,
    videos: p.videos?.length || 0,
    services: p.services?.length || 0,
  };

  return {
    ...p,

    biography: rules.biography ? p.biography : "",
    services: rules.services ? p.services : [],
    photos: rules.photos > 0 ? p.photos : [],
    videos: rules.videos > 0 ? p.videos : [],

    _entitlements: {
      plan: rules ? true : false,
      locked: {
        biography: !rules.biography,
        services: !rules.services,
        photos: rules.photos === 0,
        videos: rules.videos === 0,
      },
      hiddenCounts: {
        photos: rules.photos > 0 ? 0 : hidden.photos,
        videos: rules.videos > 0 ? 0 : hidden.videos,
        services: rules.services ? 0 : hidden.services,
      },
      limits: {
        photos: rules.photos,
        videos: rules.videos,
      },
    },
  };
};
