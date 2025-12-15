const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDateOnlyLocal(dateOnly: string): Date | null {
  // dateOnly: YYYY-MM-DD
  const m = DATE_ONLY_RE.exec(dateOnly);
  if (!m) return null;
  const [y, mo, d] = dateOnly.split('-').map((v) => parseInt(v, 10));
  if (!y || !mo || !d) return null;
  const parsed = new Date(y, mo - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDateValue(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) {
    return parseDateOnlyLocal(value);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateDdMmYyyy(value: Date | string | number | null | undefined): string {
  const d = parseDateValue(value);
  if (!d) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateDdMm(value: Date | string | number | null | undefined): string {
  const d = parseDateValue(value);
  if (!d) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export function formatDateTimeDdMmYyyyHm(value: Date | string | number | null | undefined): string {
  const d = parseDateValue(value);
  if (!d) return '';
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${formatDateDdMmYyyy(d)} ${time}`;
}
