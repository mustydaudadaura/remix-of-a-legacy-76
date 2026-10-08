import { useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RotateCcw, Check } from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_COLOURS, REPORT_PARTS, resolveReportTemplate, type ReportTemplate, type ReportPart } from '@/lib/report-template';
import { ReportCardView } from '@/components/ReportCardView';

export function ReportTemplateSettings({ school }: { school: { id: string; name: string; report_template: unknown; [key: string]: unknown } }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ReportTemplate>(school.report_template as ReportTemplate);
  const [section, setSection] = useState('secondary');
  const [part, setPart] = useState<ReportPart>('border');
  const [busy, setBusy] = useState(false);
  const resolved = resolveReportTemplate(draft, section);
  async function save() {
    setBusy(true);
    try {
      const { data, error } = await supabase.from('schools').update({ report_template: draft }).eq('id', school.id).select('id').single();
      if (error || !data) throw new Error(error?.message ?? 'Could not save settings');
      await qc.invalidateQueries({ queryKey: ['school-settings', school.id] });
      await qc.invalidateQueries({ queryKey: ['report-card'] });
      await qc.invalidateQueries({ queryKey: ['portal-rc-detail'] });
      toast.success('Report template saved');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Report card template</h2><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setDraft({})}><RotateCcw className="mr-2 h-4 w-4" />Section defaults</Button><Button disabled={busy} onClick={save}><Save className="mr-2 h-4 w-4" />{busy ? 'Saving…' : 'Save template'}</Button></div></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2"><Label>Positions on sheet</Label><Select value={resolved.positions} onValueChange={value => setDraft({ ...draft, positions: value as ReportTemplate['positions'] })}><SelectTrigger aria-label="Positions on sheet"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No positions</SelectItem><SelectItem value="class">Overall class position</SelectItem><SelectItem value="subject">Subject positions</SelectItem><SelectItem value="both">Both positions</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label>Template part</Label><Select value={part} onValueChange={value => setPart(value as ReportPart)}><SelectTrigger aria-label="Template part"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(REPORT_PARTS).map(([key,label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Preview section</Label><Select value={section} onValueChange={setSection}><SelectTrigger aria-label="Preview section"><SelectValue /></SelectTrigger><SelectContent>{['nursery','primary','secondary'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label={`${REPORT_PARTS[part]} colours`}>{REPORT_COLOURS.map(colour => <Button key={colour} variant="outline" size="icon" className="report-swatch h-10 w-10 rounded-md border-2" style={{ '--swatch': `var(--report-colour-${colour})`, color: 'var(--report-paper)' } as CSSProperties} title={colour} aria-label={`${REPORT_PARTS[part]}: ${colour}`} aria-pressed={resolved[part] === colour} onClick={() => setDraft({ ...draft, [part]: colour })}>{resolved[part] === colour && <Check className="h-5 w-5" />}</Button>)}</div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{Object.entries(REPORT_PARTS).map(([key,label]) => <span key={key} className="flex items-center gap-2"><span className="report-swatch inline-block h-3 w-3 rounded-sm" style={{ '--swatch': `var(--report-colour-${resolved[key as ReportPart]})` } as CSSProperties} />{label}</span>)}</div>
    <h3 className="border-t border-border pt-5 font-semibold">Sample report</h3>
    <ReportCardView rc={{ schools: { ...school, report_template: draft }, students: { first_name: 'Sample', last_name: 'Student', admission_no: 'SAMPLE', gender: 'female', house: '—' }, classes: { name: section === 'secondary' ? 'JSS 1' : section === 'primary' ? 'Primary 4' : 'Nursery 2', section }, session: school.current_session ?? '2026/2027', term: school.current_term ?? 'first', position: 2, class_size: 30, total_score: 162, average: 81, subjects_count: 2, gpa: 4, days_total: 60, days_present: 58, days_absent: 2, teacher_remark: 'Good progress this term.', principal_remark: 'Keep up the good work.' }} assessments={['Mathematics','English Language'].map((name,i) => ({ id: `sample-${i}`, ca1: 16, ca2: 17, exam: 48, total: 81, grade: 'A', remark: 'Excellent', subject_position: 2, subjects: { name, code: null } }))} />
  </div>;
}