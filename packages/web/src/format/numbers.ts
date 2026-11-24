import type { Range } from '@roster-radius/core';

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const longDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function formatNumber(value: number): string {
  return integer.format(value);
}

export function formatPercent(share: number): string {
  return percent.format(share);
}

/** "1,660" when the value is known, "1,600 to 3,200" when only its bounds are. */
export function formatRange(range: Range): string {
  if (range.min !== range.max) return `${formatNumber(range.min)} to ${formatNumber(range.max)}`;

  return formatNumber(range.max);
}

/** A YYYY-MM-DD date as "November 17, 2026". */
export function formatDate(date: string): string {
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? date : longDate.format(time);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}
