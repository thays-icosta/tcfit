const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function getYoutubeVideoId(url) {
  if (!url) return null;
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] : null;
}

export function getYoutubeThumbnailUrl(url) {
  const id = getYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/0.jpg` : null;
}
