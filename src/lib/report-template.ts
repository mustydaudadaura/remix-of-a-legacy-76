export const REPORT_COLOURS = ['emerald','forest','green','lime','olive','teal','turquoise','cyan','sky','blue','navy','indigo','violet','purple','plum','magenta','pink','rose','red','crimson','orange','amber','gold','brown','slate','charcoal'] as const;
export const REPORT_PARTS = { border: 'Sheet border', heading: 'School heading', table: 'Results headings', rows: 'Alternate subject rows', biodata: 'Student details', development: 'Development ratings', comments: 'Staff comments' };
export type ReportColour = typeof REPORT_COLOURS[number];
export type ReportPart = keyof typeof REPORT_PARTS;
export type ReportTemplate = Partial<Record<ReportPart, ReportColour>> & { positions?: 'none' | 'class' | 'subject' | 'both' };
export function resolveReportTemplate(value: unknown, section?: string | null): Required<ReportTemplate> {
  const fallback = section === 'nursery' ? 'forest' : section === 'primary' ? 'blue' : 'purple';
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const colour = (key: ReportPart): ReportColour => REPORT_COLOURS.includes(source[key] as ReportColour) ? source[key] as ReportColour : fallback;
  return { border: colour('border'), heading: colour('heading'), table: colour('table'), rows: colour('rows'), biodata: colour('biodata'), development: colour('development'), comments: colour('comments'), positions: ['none','class','subject','both'].includes(String(source.positions)) ? source.positions as Required<ReportTemplate>['positions'] : 'class' };
}
export function positionVisibility(mode: Required<ReportTemplate>['positions']) {
  return { class: mode === 'class' || mode === 'both', subject: mode === 'subject' || mode === 'both' };
}