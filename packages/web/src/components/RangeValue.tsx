import type { Range } from '@roster-radius/core';
import { formatRange } from '../format/numbers';

/** A count that may be known only as a range, because some sources give a number of people instead of a list. */
export function RangeValue({ range }: { readonly range: Range }) {
  if (range.min === range.max) return <>{formatRange(range)}</>;

  return <span title="Some sources give only a count, so the exact number cannot be known.">{formatRange(range)}</span>;
}
