export function parseIso8601DurationToSeconds(value?: string): number | null {
  if (!value) return null;

  // Supports common `PT#H#M#S` with optional fractional seconds.
  const match = String(value).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return null;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  if (!isFinite(hours) || !isFinite(minutes) || !isFinite(seconds)) return null;

  const total = hours * 3600 + minutes * 60 + seconds;
  if (!isFinite(total) || total < 0) return null;

  return Math.round(total);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDurationHmsFromSeconds(totalSeconds?: number | null): string {
  if (totalSeconds == null) return '—';
  const s = typeof totalSeconds === 'number' ? totalSeconds : Number(totalSeconds);
  if (!isFinite(s) || s < 0) return '—';

  const rounded = Math.round(s);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  return `${minutes}m ${pad2(seconds)}s`;
}

export function formatIsoDurationHms(value?: string): string {
  const seconds = parseIso8601DurationToSeconds(value);
  return formatDurationHmsFromSeconds(seconds);
}

export function formatMinutesHms(minutes?: number | null): string {
  if (minutes == null) return '—';
  const m = typeof minutes === 'number' ? minutes : Number(minutes);
  if (!isFinite(m) || m < 0) return '—';
  return formatDurationHmsFromSeconds(Math.round(m * 60));
}
