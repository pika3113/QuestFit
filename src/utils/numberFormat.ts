export function formatCompactNumber(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs < 1000) {
    return `${Math.round(value)}`;
  }

  if (abs < 1_000_000) {
    const k = abs / 1000;
    const text = k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k).toString();
    return `${sign}${text}k`;
  }

  if (abs < 1_000_000_000) {
    const m = abs / 1_000_000;
    const text = m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m).toString();
    return `${sign}${text}M`;
  }

  const b = abs / 1_000_000_000;
  const text = b < 10 ? b.toFixed(1).replace(/\.0$/, '') : Math.round(b).toString();
  return `${sign}${text}B`;
}
