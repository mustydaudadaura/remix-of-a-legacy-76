import { useEffect, useState, type CSSProperties } from "react";
import { resolveReportTemplate, positionVisibility } from "@/lib/report-template";
import {
  resolveSchoolAcademicConfig,
  CA_RATIOS,
  getGradingScale,
  getScaleForSection,
} from "@/lib/grading";
import QRCode from "qrcode";
import { ShieldCheck, GraduationCap } from "lucide-react";

type Assessment = {
  id: string;
  subject_position?: number | null;
  ca1: number; ca2: number; exam: number; total: number;
  grade: string | null; remark: string | null;
  subjects: { name: string; code: string | null } | null;
};

export function ReportCardView({ rc, assessments }: { rc: any; assessments: Assessment[] }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const school: any = rc.schools;
  const student: any = rc.students;
  const klass: any = rc.classes;
  const fullName = [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ");

  const psychomotor = (rc.psychomotor as Record<string, number>) || {};
  const affective = (rc.affective as Record<string, number>) || {};
  const defaultPsy = { Handwriting: 0, Drawing: 0, Sports: 0, Music: 0, Verbal: 0, Public_Speaking: 0 };
  const defaultAff = { Punctuality: 0, Neatness: 0, Honesty: 0, Politeness: 0, Cooperation: 0, Leadership: 0 };
  const psyMerged = { ...defaultPsy, ...psychomotor };
  const affMerged = { ...defaultAff, ...affective };

  const rawSection = (klass?.section as string | undefined)?.toLowerCase();
  const section: "nursery" | "primary" | "secondary" =
    rawSection === "nursery" || rawSection === "primary" || rawSection === "secondary"
      ? rawSection
      : "secondary";
  const template = resolveReportTemplate(school?.report_template, section);
  const academicConfig = resolveSchoolAcademicConfig(school?.report_template);
  const caRatioConfig = CA_RATIOS[academicConfig.caRatio] || CA_RATIOS["20_20_60"];
  const scaleType = getScaleForSection(section);
  const activeScale = getGradingScale(scaleType);

  const positions = positionVisibility(template.positions);
  const themeStyle = Object.fromEntries(Object.entries(template).filter(([key]) => key !== 'positions').map(([key, value]) => [`--rc-${key}`, `var(--report-colour-${value})`])) as CSSProperties;
  const THEME = { c: `var(--report-colour-${template.border})`, soft: `color-mix(in oklab, var(--report-colour-${template.border}) 10%, transparent)` };


  useEffect(() => {
    if (!rc?.verification_code || typeof window === "undefined") return;
    const url = `${window.location.origin}/verify/${rc.verification_code}`;
    QRCode.toDataURL(url, { width: 160, margin: 1 }).then(setQrDataUrl);
  }, [rc?.verification_code]);

  return (
    <>
      <div className="max-w-full overflow-x-auto">
      <div
        className="report-sheet mx-auto my-6  shadow-lg print:shadow-none print:my-0 relative overflow-hidden"
        style={{ ...themeStyle, "--rc": THEME.c } as CSSProperties}
      >
        {school?.logo_url && (
          <div className="report-watermark pointer-events-none absolute inset-0 flex items-center justify-center print:flex">
            <img src={school.logo_url} alt="" className="w-[70%] max-w-[480px] object-contain" />
          </div>
        )}
        <div className="report-frame relative border-[6px] border-double border-[var(--rc)] m-2 p-5">
          <div className="flex items-start gap-4 border-b-2 border-[var(--rc)] pb-3">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="logo" className="h-20 w-20 object-contain" />
            ) : (
              <div className="h-20 w-20 rounded-full grid place-items-center text-xs text-[var(--rc)]" style={{ background: THEME.soft }}>LOGO</div>
            )}
            <div className="flex-1 text-center">
              <h1 className="report-heading text-xl font-extrabold uppercase">{school?.name || "School Name"}</h1>
              {school?.motto && <p className="italic text-xs">— {school.motto} —</p>}
              <p className="text-xs mt-1">{school?.address}</p>
              <p className="text-[11px]">{[school?.phone, school?.email, school?.website].filter(Boolean).join("  •  ")}</p>
              {school?.branch_name && <p className="text-[11px] font-semibold">Branch: {school.branch_name}</p>}
              <p className="mt-2 inline-block bg-[var(--rc)] text-[var(--report-paper)] text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded">
                Student Report Card — {rc.session} • {String(rc.term).toUpperCase()} TERM
              </p>
            </div>
            {student?.photo_url ? (
              <img src={student.photo_url} alt="passport" className="h-24 w-20 object-cover border-2 border-[var(--rc)]" />
            ) : (
              <div className="h-24 w-20 border-2 border-dashed grid place-items-center text-[10px] text-muted-foreground" style={{ borderColor: THEME.c }}>Passport</div>
            )}
          </div>

          <div className="report-biodata grid grid-cols-3 gap-x-4 gap-y-1 text-[12px] mt-3">
            <div><strong>Name:</strong> {fullName.toUpperCase()}</div>
            <div><strong>Adm. No.:</strong> {student?.admission_no}</div>
            <div><strong>Class:</strong> {klass?.name} {klass?.arm}</div>
            <div><strong>Gender:</strong> {student?.gender}</div>
            <div><strong>D.O.B:</strong> {student?.dob}</div>
            <div><strong>House:</strong> {student?.house || "—"}</div>
            {positions.class && <div><strong>Position:</strong> {rc.position} of {rc.class_size}</div>}
            <div><strong>Average:</strong> {rc.average}%</div>
            <div><strong>GPA:</strong> {rc.gpa}</div>
          </div>

          <table className="report-results w-full mt-3 border-collapse text-[11px]">
            <thead>
              <tr className="bg-[var(--rc)] text-[var(--report-paper)]">
                <th className="border border-[var(--rc)] px-2 py-1 text-left">Subject</th>
                <th className="border border-[var(--rc)] px-2 py-1">{caRatioConfig.ca1Label} ({caRatioConfig.ca1Max})</th>
                {caRatioConfig.ca2Max > 0 && <th className="border border-[var(--rc)] px-2 py-1">{caRatioConfig.ca2Label} ({caRatioConfig.ca2Max})</th>}
                <th className="border border-[var(--rc)] px-2 py-1">{caRatioConfig.examLabel} ({caRatioConfig.examMax})</th>
                <th className="border border-[var(--rc)] px-2 py-1">Total (100)</th>
                {positions.subject && <th className="border px-2 py-1">Position</th>}
                <th className="border border-[var(--rc)] px-2 py-1">Grade</th>
                <th className="border border-[var(--rc)] px-2 py-1 text-left">Remark</th>
              </tr>
            </thead>
            <tbody>
              {(assessments ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="border px-2 py-1">{a.subjects?.name}</td>
                  <td className="border px-2 py-1 text-center">{a.ca1}</td>
                  {caRatioConfig.ca2Max > 0 && <td className="border px-2 py-1 text-center">{a.ca2}</td>}
                  <td className="border px-2 py-1 text-center">{a.exam}</td>
                  <td className="border px-2 py-1 text-center font-semibold">{a.total}</td>
                  {positions.subject && <td className="border px-2 py-1 text-center">{a.subject_position ?? "—"}</td>}
                  <td className="border px-2 py-1 text-center font-bold">{a.grade}</td>
                  <td className="border px-2 py-1">{a.remark}</td>
                </tr>
              ))}
              {!assessments?.length && (
                <tr><td colSpan={positions.subject ? (caRatioConfig.ca2Max > 0 ? 8 : 7) : (caRatioConfig.ca2Max > 0 ? 7 : 6)} className="border px-2 py-3 text-center text-muted-foreground">No subject assessments captured.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="border px-2 py-1">Total / Average</td>
                <td className="border px-2 py-1 text-center" colSpan={caRatioConfig.ca2Max > 0 ? 3 : 2}>Subjects: {rc.subjects_count}</td>
                <td className="border px-2 py-1 text-center">{rc.total_score}</td>
                <td className="border px-2 py-1 text-center">{rc.average}%</td>
                {positions.subject && <td className="border px-2 py-1" />}
                <td className="border px-2 py-1">{positions.class ? `Class position ${rc.position}` : ""}</td>
              </tr>
            </tfoot>
          </table>

          <div className="report-development grid grid-cols-3 gap-3 mt-3 text-[11px]">
            <div>
              <h3 className="font-bold text-[var(--rc)] border-b border-[var(--rc)] mb-1">
                {scaleType === "waec_9point" ? "WAEC/NECO 9-Point Scale" : "Basic Education Grading Key"}
              </h3>
              <ul className="space-y-0.5 text-[10px]">
                {activeScale.map((s) => (
                  <li key={s.grade} className="flex justify-between items-center pr-1">
                    <span className="font-bold font-mono">{s.grade}</span>
                    <span className="text-muted-foreground">{s.min}–{s.max}%</span>
                    <span className="truncate">{s.remark}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[var(--rc)] border-b border-[var(--rc)] mb-1">Psychomotor (1–5)</h3>
              <table className="w-full">
                <tbody>
                  {Object.entries(psyMerged).map(([k, v]) => (
                    <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="text-right font-semibold">{v || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-bold text-[var(--rc)] border-b border-[var(--rc)] mb-1">Affective (1–5)</h3>
              <table className="w-full">
                <tbody>
                  {Object.entries(affMerged).map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td className="text-right font-semibold">{v || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-3 text-[11px]">
            <div className="border border-[var(--rc)] p-2"><strong>Days Open:</strong> {rc.days_total ?? "—"}</div>
            <div className="border border-[var(--rc)] p-2"><strong>Present:</strong> {rc.days_present ?? "—"}</div>
            <div className="border border-[var(--rc)] p-2"><strong>Absent:</strong> {rc.days_absent ?? "—"}</div>
            <div className="border border-[var(--rc)] p-2"><strong>Next Resumption:</strong> {rc.next_resumption_date ?? student?.next_resumption_date ?? "—"}</div>
          </div>

          {rc.annual_evaluation && (
            <div className="report-promotion mt-3 border-2 border-[var(--rc)] p-2.5 rounded text-[11px]" style={{ background: THEME.soft }}>
              <div className="flex items-center justify-between border-b border-[var(--rc)] pb-1 mb-1.5">
                <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-[var(--rc)]">
                  <GraduationCap className="h-4 w-4" />
                  Official 3-Term Cumulative Promotion Evaluation ({rc.session})
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    rc.annual_evaluation.promotion.decision === "promoted" || rc.annual_evaluation.promotion.decision === "graduated"
                      ? "bg-emerald-600 text-white"
                      : rc.annual_evaluation.promotion.decision === "trial"
                      ? "bg-amber-600 text-white"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {rc.annual_evaluation.promotion.decisionLabel}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div><strong>1st Term:</strong> {rc.annual_evaluation.term1 != null ? `${rc.annual_evaluation.term1}%` : "—"}</div>
                <div><strong>2nd Term:</strong> {rc.annual_evaluation.term2 != null ? `${rc.annual_evaluation.term2}%` : "—"}</div>
                <div><strong>3rd Term:</strong> {rc.annual_evaluation.term3 != null ? `${rc.annual_evaluation.term3}%` : "—"}</div>
                <div><strong>Cumulative Average:</strong> <span className="font-bold">{rc.annual_evaluation.cumulativeAverage}%</span></div>
              </div>
              <p className="text-[10px] opacity-90 mt-1">
                <strong>Status:</strong> {rc.annual_evaluation.promotion.reason} ({rc.annual_evaluation.formula})
              </p>
            </div>
          )}

          <div className="report-comments mt-3 space-y-2 text-[12px]">
            <div className="border border-[var(--rc)] p-2"><strong className="text-[var(--rc)]">Class Teacher's Remark:</strong> {rc.teacher_remark || "—"}</div>
            <div className="border border-[var(--rc)] p-2"><strong className="text-[var(--rc)]">Principal's Remark:</strong> {rc.principal_remark || "—"}</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-5 items-end text-[11px]">
            <div className="text-center">
              <div className="h-10 border-b border-dotted border-[var(--report-grid)] mb-1" />
              <div>Class Teacher's Signature</div>
            </div>
            <div className="text-center">
              {school?.principal_signature_url ? (
                <img src={school.principal_signature_url} className="h-10 mx-auto object-contain" alt="sign" />
              ) : (
                <div className="h-10 border-b border-dotted border-[var(--report-grid)] mb-1" />
              )}
              <div>{school?.principal_name || "Principal"}</div>
            </div>
            <div className="text-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} className="h-20 w-20 mx-auto" alt="QR verify" />
              ) : <div className="h-20 w-20 mx-auto bg-muted" />}
              <div className="flex items-center justify-center gap-1 text-[10px] mt-1">
                <ShieldCheck className="h-3 w-3 text-[var(--rc)]" />
                Verify: {rc.verification_code}
              </div>
            </div>
          </div>

          {school?.stamp_url && (
            <img src={school.stamp_url} alt="stamp" className="absolute right-10 bottom-20 h-24 w-24 opacity-30 pointer-events-none" />
          )}
        </div>
      </div>

      </div>
      <style>{`
        .report-sheet { width: 210mm; min-height: 297mm; position: relative; }
        .report-watermark { opacity: 0.06; z-index: 0; }
        .report-sheet > div:not(.report-watermark) { position: relative; z-index: 1; }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          .report-sheet { width: 100%; min-height: 100vh; box-shadow: none; margin: 0; }
          .report-watermark { opacity: 0.06 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
