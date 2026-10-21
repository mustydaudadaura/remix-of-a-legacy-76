import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { REPORT_COLOURS, resolveReportTemplate, positionVisibility, REPORT_LAYOUTS } from './report-template';
describe('school report configuration', () => {
  it('offers more than 20 distinct colours', () => { assert.ok(new Set(REPORT_COLOURS).size > 20); });
  it('independently resolves selected parts', () => { const c = resolveReportTemplate({ border: 'red', table: 'teal', comments: 'gold' }, 'primary'); assert.deepEqual([c.border,c.table,c.comments,c.heading],['red','teal','gold','blue']); });
  it('keeps section defaults', () => { assert.deepEqual(['nursery','primary','secondary',null].map(s => resolveReportTemplate({},s).border),['forest','blue','purple','purple']); });
  it('supports both positions', () => { assert.deepEqual(positionVisibility('both'),{ class: true, subject: true }); });
  it('supports no positions', () => { assert.deepEqual(positionVisibility('none'),{ class: false, subject: false }); });
  it('supports class-only positions', () => { assert.deepEqual(positionVisibility('class'),{ class: true, subject: false }); });
  it('supports subject-only positions', () => { assert.deepEqual(positionVisibility('subject'),{ class: false, subject: true }); });
  it('provides at least 5 Nigerian report layouts including classic comprehensive reincluded', () => {
    assert.ok(REPORT_LAYOUTS.length >= 5);
    const ids = REPORT_LAYOUTS.map((l: any) => l.id);
    assert.ok(ids.includes('classic_comprehensive'));
    assert.ok(ids.includes('premier_standard'));
    assert.ok(ids.includes('modern_executive'));
    assert.ok(ids.includes('ubec_basic'));
    assert.ok(ids.includes('islamic_integrated'));
    assert.ok(ids.includes('waec_senior'));
  });
  it('resolves layout_id defaulting to classic_comprehensive', () => {
    const c1 = resolveReportTemplate({});
    assert.equal(c1.layout_id, 'classic_comprehensive');
    const c2 = resolveReportTemplate({ layout_id: 'waec_senior' });
    assert.equal(c2.layout_id, 'waec_senior');
  });
});