export const extractYouTubeId = (url) => {
    if (!url) return null;

    const regex =
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&?/]+)/;

    const match = url.match(regex);
    return match ? match[1] : null;
};

export const getYouTubeThumbnail = (videoId) => {
    if (!videoId) return null;

    return {
        max: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
};

