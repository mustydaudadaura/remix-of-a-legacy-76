export type TermReport = { student_id: string; term: 'first' | 'second' | 'third'; average: number | null; total_score: number | null; days_present: number | null; days_total: number | null };
export type YearlyRow = { student_id: string; terms: Partial<Record<TermReport['term'], number>>; average: number; daysPresent: number; daysTotal: number; position: number };

/** Yearly average = mean of the term averages that exist; ties share a position. */
export function yearlySummary(reports: TermReport[]): YearlyRow[] {
  const map = new Map<string, YearlyRow>();
  for (const r of reports) {
    const row = map.get(r.student_id) ?? { student_id: r.student_id, terms: {}, average: 0, daysPresent: 0, daysTotal: 0, position: 0 };
    if (r.average != null) row.terms[r.term] = Number(r.average);
    row.daysPresent += r.days_present ?? 0; row.daysTotal += r.days_total ?? 0;
    map.set(r.student_id, row);
  }
  const rows = [...map.values()].map(r => { const v = Object.values(r.terms); return { ...r, average: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }; });
  rows.sort((a, b) => b.average - a.average);
  rows.forEach((r, i) => { r.position = i > 0 && Math.abs(rows[i - 1].average - r.average) < 1e-9 ? rows[i - 1].position : i + 1; });
  return rows;
}
