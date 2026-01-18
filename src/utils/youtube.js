export const extractYouTubeId = (url) => {
  if (!url) return null;

  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&?/]+)/;

  const match = url.match(regex);
  return match ? match[1] : null;
};

// Smart thumbnail (HD first, fallback safe)
export const getYouTubeThumbnail = (videoId) => {
  if (!videoId) return null;

  // Use maxres by default (YouTube auto-fallbacks if unavailable)
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

