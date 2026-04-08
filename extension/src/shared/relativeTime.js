const MINUTE_MS = 60 * 1000;
const HOUR_MINUTES = 60;

export const formatRelativeTime = (now, closedAt) => {
  const elapsedMs = Math.max(0, now - closedAt);
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / MINUTE_MS));

  if (elapsedMinutes < HOUR_MINUTES) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.max(1, Math.floor(elapsedMinutes / HOUR_MINUTES));
  return `${elapsedHours} hr ago`;
};
