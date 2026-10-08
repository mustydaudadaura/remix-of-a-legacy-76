import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { REPORT_COLOURS, resolveReportTemplate, positionVisibility } from './report-template';
describe('school report configuration', () => {
  it('offers more than 20 distinct colours', () => { assert.ok(new Set(REPORT_COLOURS).size > 20); });
  it('independently resolves selected parts', () => { const c = resolveReportTemplate({ border: 'red', table: 'teal', comments: 'gold' }, 'primary'); assert.deepEqual([c.border,c.table,c.comments,c.heading],['red','teal','gold','blue']); });
  it('keeps section defaults', () => { assert.deepEqual(['nursery','primary','secondary',null].map(s => resolveReportTemplate({},s).border),['forest','blue','purple','purple']); });
  it('supports both positions', () => { assert.deepEqual(positionVisibility('both'),{ class: true, subject: true }); });
  it('supports no positions', () => { assert.deepEqual(positionVisibility('none'),{ class: false, subject: false }); });
  it('supports class-only positions', () => { assert.deepEqual(positionVisibility('class'),{ class: true, subject: false }); });
  it('supports subject-only positions', () => { assert.deepEqual(positionVisibility('subject'),{ class: false, subject: true }); });
});