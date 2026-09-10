/** Season-to-date totals supplied without individual matches or participation counts. */
export interface HistoricalPlayerTotal {
  playerId: string;
  sourceName: string;
  season: number;
  throughDate: string;
  goals: number;
  assists: number;
  bottomCount: number;
}

/** A cumulative snapshot cannot be split across months or weeks. */
export function historicalTotalsForPeriod(
  totals: readonly HistoricalPlayerTotal[], start?: string, end?: string
): HistoricalPlayerTotal[] {
  return totals.filter((t) =>
    (!start || start <= `${t.season}-01-01`) && (!end || end >= t.throughDate)
  );
}

export function isCoveredByHistoricalTotal(
  totals: readonly HistoricalPlayerTotal[], playerId: string, date: string
): boolean {
  return totals.some((t) => t.playerId === playerId
    && date >= `${t.season}-01-01` && date <= t.throughDate);
}
