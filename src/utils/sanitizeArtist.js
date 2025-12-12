export const sanitizeArtistForPlan = (artistDoc, rules) => {
  const a = artistDoc.toObject ? artistDoc.toObject() : { ...artistDoc };

  const hiddenPhotosCount = a.photos?.length || 0;
  const hiddenMp3Count = a.mp3Files?.length || 0;

  return {
    ...a,

    biography: rules.biography ? a.biography : "",
    photos: rules.photos > 0 ? a.photos : [],
    mp3Files: rules.mp3 > 0 ? a.mp3Files : [],

    _entitlements: {
      locked: {
        biography: !rules.biography,
        photos: rules.photos === 0,
        mp3: rules.mp3 === 0,
      },
      hiddenCounts: {
        photos: rules.photos > 0 ? 0 : hiddenPhotosCount,
        mp3: rules.mp3 > 0 ? 0 : hiddenMp3Count,
      },
      limits: {
        photos: rules.photos,
        mp3: rules.mp3,
      },
    },
  };
};
