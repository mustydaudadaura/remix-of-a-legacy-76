import { describe, it, expect } from 'bun:test';
import { REPORT_COLOURS, resolveReportTemplate, positionVisibility } from './report-template';
describe('school report configuration', () => {
  it('offers more than 20 distinct colours', () => { expect(new Set(REPORT_COLOURS).size).toBeGreaterThan(20); });
  it('independently resolves selected parts', () => { const c = resolveReportTemplate({ border: 'red', table: 'teal', comments: 'gold' }, 'primary'); expect([c.border,c.table,c.comments,c.heading]).toEqual(['red','teal','gold','blue']); });
  it('keeps section defaults', () => { expect(['nursery','primary','secondary',null].map(s => resolveReportTemplate({},s).border)).toEqual(['forest','blue','purple','purple']); });
  it('supports both positions', () => { expect(positionVisibility('both')).toEqual({ class: true, subject: true }); });
  it('supports no positions', () => { expect(positionVisibility('none')).toEqual({ class: false, subject: false }); });
  it('supports class-only positions', () => { expect(positionVisibility('class')).toEqual({ class: true, subject: false }); });
  it('supports subject-only positions', () => { expect(positionVisibility('subject')).toEqual({ class: false, subject: true }); });
});