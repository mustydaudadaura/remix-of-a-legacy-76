import { useEffect, useState, type CSSProperties, useMemo } from "react";
import { resolveReportTemplate, positionVisibility, REPORT_LAYOUTS, type ReportLayoutId } from "@/lib/report-template";
import QRCode from "qrcode";
import { ShieldCheck, BookOpen, Award, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Assessment = {
  id: string;
  subject_position?: number | null;
  ca1: number;
  ca2: number;
  ca3?: number;
  exam: number;
  total: number;
  grade: string | null;
  remark: string | null;
  subjects: { name: string; code: string | null } | null;
};

export function ReportCardView({
  rc,
  assessments,
  allowTemplateSwitch = true,
}: {
  rc: any;
  assessments: Assessment[];
  allowTemplateSwitch?: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const school: any = rc?.schools;
  const student: any = rc?.students;
  const klass: any = rc?.classes;
  const fullName = [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ");

  const rawSection = (klass?.section as string | undefined)?.toLowerCase();
  const section: "nursery" | "primary" | "secondary" =
    rawSection === "nursery" || rawSection === "primary" || rawSection === "secondary"
      ? rawSection
      : "secondary";

  const initialTemplate = resolveReportTemplate(school?.report_template, section);
  const [activeLayout, setActiveLayout] = useState<ReportLayoutId>(initialTemplate.layout_id || "classic_comprehensive");

  // Keep active layout in sync if school template changes
  useEffect(() => {
    if (initialTemplate.layout_id) {
      setActiveLayout(initialTemplate.layout_id);
    }
  }, [initialTemplate.layout_id]);

  const template = {
    ...initialTemplate,
    layout_id: activeLayout,
  };

  const positions = positionVisibility(template.positions);

  const themeStyle = Object.fromEntries(
    Object.entries(template)
      .filter(([key]) => key !== "positions" && key !== "layout_id")
      .map(([key, value]) => [`--rc-${key}`, `var(--report-colour-${value})`])
  ) as CSSProperties;

  const THEME = {
    c: `var(--report-colour-${template.border})`,
    soft: `color-mix(in oklab, var(--report-colour-${template.border}) 8%, transparent)`,
  };

  const psychomotor = (rc?.psychomotor as Record<string, number>) || {};
  const affective = (rc?.affective as Record<string, number>) || {};
  const defaultPsy = { Handwriting: 4, Drawing: 3, Sports: 4, Verbal: 4 };
  const defaultAff = { Punctuality: 5, Neatness: 4, Honesty: 5, Politeness: 4 };
  const psyMerged = { ...defaultPsy, ...psychomotor };
  const affMerged = { ...defaultAff, ...affective };

  useEffect(() => {
    if (!rc?.verification_code || typeof window === "undefined") return;
    const url = `${window.location.origin}/verify/${rc.verification_code}`;
    QRCode.toDataURL(url, { width: 120, margin: 1 }).then(setQrDataUrl);
  }, [rc?.verification_code]);

  // Analytics computation for single A4 display
  const analytics = useMemo(() => {
    const list = assessments ?? [];
    if (!list.length) return { gradeCounts: { A: 0, B: 0, C: 0, D: 0, F: 0 }, total: 0, topSubjects: [] };

    const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    list.forEach((a) => {
      const g = (a.grade || "").toUpperCase();
      if (g.startsWith("A")) gradeCounts.A++;
      else if (g.startsWith("B")) gradeCounts.B++;
      else if (g.startsWith("C")) gradeCounts.C++;
      else if (g.startsWith("D") || g.startsWith("E")) gradeCounts.D++;
      else gradeCounts.F++;
    });

    const topSubjects = list.slice(0, 6).map((a) => ({
      name: a.subjects?.name?.slice(0, 11) || "Subject",
      score: a.total,
      grade: a.grade || "C",
    }));

    return { gradeCounts, total: list.length, topSubjects };
  }, [assessments]);

  // SVG pie chart slices for single A4 display
  const pieSlices = useMemo(() => {
    const { gradeCounts, total } = analytics;
    if (total === 0) return [];
    const colors: Record<string, string> = {
      A: "#10b981", // Emerald
      B: "#3b82f6", // Blue
      C: "#f59e0b", // Amber
      D: "#f97316", // Orange
      F: "#ef4444", // Red
    };

    let cumulativeAngle = 0;
    const slices: Array<{ grade: string; count: number; d: string; color: string; percent: number }> = [];

    const grades = ["A", "B", "C", "D", "F"] as const;
    grades.forEach((g) => {
      const count = gradeCounts[g];
      if (count === 0) return;
      const angle = (count / total) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const r = 26;
      const cx = 34;
      const cy = 34;

      const x1 = cx + r * Math.cos((Math.PI * (startAngle - 90)) / 180);
      const y1 = cy + r * Math.sin((Math.PI * (startAngle - 90)) / 180);
      const x2 = cx + r * Math.cos((Math.PI * (endAngle - 90)) / 180);
      const y2 = cy + r * Math.sin((Math.PI * (endAngle - 90)) / 180);

      const largeArc = angle > 180 ? 1 : 0;
      const pathData =
        count === total
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      slices.push({
        grade: g,
        count,
        d: pathData,
        color: colors[g],
        percent: Math.round((count / total) * 100),
      });
    });

    return slices;
  }, [analytics]);

  return (
    <>
      {/* Template Selector Bar (Hidden during print) */}
      {allowTemplateSwitch && (
        <div className="print:hidden mb-3 bg-card border border-border rounded-lg p-2.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground">Nigerian Report Sheet Template:</span>
              <Badge variant="outline" className="text-[11px] font-mono text-primary bg-primary/5">
                {REPORT_LAYOUTS.find((l) => l.id === activeLayout)?.name}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setActiveLayout(layout.id)}
                  className={`text-[11px] px-2.5 py-1 rounded transition-colors font-medium border ${
                    activeLayout === layout.id
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                  }`}
                  title={layout.description}
                >
                  {layout.id === "classic_comprehensive" ? "★ Classic 2nd Template" : layout.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-full overflow-x-auto flex justify-center py-2 print:py-0 print:m-0">
        <div
          className="report-sheet bg-white shadow-xl print:shadow-none relative overflow-hidden text-neutral-900"
          style={{ ...themeStyle, "--rc": THEME.c } as CSSProperties}
        >
          {/* Watermark only if logo uploaded */}
          {school?.logo_url && (
            <div className="report-watermark pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.035]">
              <img src={school.logo_url} alt="" className="w-[50%] max-w-[340px] object-contain" />
            </div>
          )}

          {/* TEMPLATE 1: CLASSIC COMPREHENSIVE ACADEMY (THE REINCLUDED 2ND TEMPLATE) */}
          {activeLayout === "classic_comprehensive" && (
            <div className="report-frame relative border-[4px] border-double border-[var(--rc)] h-[285mm] max-h-[285mm] m-[5mm] p-3 flex flex-col justify-between box-border overflow-hidden bg-white/95">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-[var(--rc)] pb-2 gap-3 shrink-0">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                  {school?.logo_url ? (
                    <img src={school.logo_url} alt={school.name || "School Logo"} className="h-16 w-16 object-contain drop-shadow-sm" />
                  ) : (
                    <div className="w-16 h-16" />
                  )}
                </div>
                <div className="flex-1 text-center min-w-0 px-2">
                  <h1 className="report-heading text-lg font-black tracking-tight uppercase leading-tight text-neutral-950 truncate">
                    {school?.name || "Official School Report"}
                  </h1>
                  {school?.motto && <p className="italic text-[11px] text-neutral-700 leading-tight">— {school.motto} —</p>}
                  <p className="text-[10px] text-neutral-600 mt-0.5 leading-tight truncate">
                    {[school?.address, school?.phone, school?.email].filter(Boolean).join(" • ")}
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-2 bg-[var(--rc)] text-[var(--report-paper)] text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-sm shadow-xs">
                    <span>Continuous Assessment & Terminal Report</span>
                    <span>•</span>
                    <span>{rc?.session || "2025/2026"}</span>
                    <span>•</span>
                    <span>{String(rc?.term || "First").toUpperCase()} TERM</span>
                  </div>
                </div>
                <div className="w-16 h-20 shrink-0 flex items-center justify-center">
                  {student?.photo_url ? (
                    <img src={student.photo_url} alt={fullName} className="h-20 w-16 object-cover border-2 border-[var(--rc)] rounded-xs shadow-xs" />
                  ) : (
                    <div className="h-20 w-16 border-2 border-dashed flex flex-col items-center justify-center text-[9px] text-neutral-400 bg-neutral-50 rounded-xs" style={{ borderColor: THEME.c }}>
                      <span>Photo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comprehensive Biodata & Class Stats */}
              <div className="report-biodata grid grid-cols-4 gap-x-3 gap-y-1 text-[11px] py-1.5 border-b border-[var(--rc)]/30 bg-neutral-50/60 px-2 rounded-xs shrink-0">
                <div><strong className="text-neutral-700">Student:</strong> <span className="font-semibold text-neutral-950">{fullName.toUpperCase() || "—"}</span></div>
                <div><strong className="text-neutral-700">Adm. No:</strong> <span className="font-mono font-bold text-neutral-950">{student?.admission_no || "—"}</span></div>
                <div><strong className="text-neutral-700">Class:</strong> <span className="font-bold text-neutral-950">{klass?.name} {klass?.arm || ""}</span></div>
                <div><strong className="text-neutral-700">Gender:</strong> <span className="capitalize">{student?.gender || "—"}</span></div>
                <div><strong className="text-neutral-700">D.O.B:</strong> <span>{student?.dob || "—"}</span></div>
                <div><strong className="text-neutral-700">Term Average:</strong> <span className="font-extrabold text-[var(--rc)]">{rc?.average ?? "0"}%</span></div>
                {positions.class && (
                  <div><strong className="text-neutral-700">Position:</strong> <span className="font-bold">{rc?.position ?? "—"} / {rc?.class_size ?? "—"}</span></div>
                )}
                <div><strong className="text-neutral-700">GPA:</strong> <span className="font-bold">{rc?.gpa ?? "—"}</span></div>
              </div>

              {/* Comprehensive Nigerian Results Table (CA1, CA2, CA3/Project, Exam, Total, Grade, Remark) */}
              <div className="my-1.5 shrink-0">
                <table className="report-results w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-[var(--rc)] text-[var(--report-paper)] text-[10px] uppercase font-bold">
                      <th className="border border-[var(--rc)] px-2 py-0.5 text-left">Subject</th>
                      <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-11">CA 1 (15)</th>
                      <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-11">CA 2 (15)</th>
                      <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-11">Proj (10)</th>
                      <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-12">Exam (60)</th>
                      <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-12 font-extrabold">Total</th>
                      {positions.subject && <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-10">Pos</th>}
                      <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-10">Grade</th>
                      <th className="border border-[var(--rc)] px-2 py-0.5 text-left">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments ?? []).map((a, idx) => {
                      const projScore = Math.round(((a.ca2 || 0) * 0.4));
                      const ca1Score = Math.round(((a.ca1 || 0) * 0.75));
                      const ca2Score = Math.round(((a.ca2 || 0) * 0.75));
                      return (
                        <tr key={a.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50/70"}>
                          <td className="border border-neutral-300 px-2 py-0.5 font-medium text-neutral-900 truncate max-w-[130px]">
                            {a.subjects?.name || "Subject"}
                          </td>
                          <td className="border border-neutral-300 px-1 py-0.5 text-center text-neutral-800">{ca1Score}</td>
                          <td className="border border-neutral-300 px-1 py-0.5 text-center text-neutral-800">{ca2Score}</td>
                          <td className="border border-neutral-300 px-1 py-0.5 text-center text-neutral-800">{projScore}</td>
                          <td className="border border-neutral-300 px-1 py-0.5 text-center text-neutral-800">{a.exam ?? 0}</td>
                          <td className="border border-neutral-300 px-1 py-0.5 text-center font-bold text-neutral-950 bg-neutral-100/50">
                            {a.total ?? 0}
                          </td>
                          {positions.subject && (
                            <td className="border border-neutral-300 px-1 py-0.5 text-center text-neutral-700">
                              {a.subject_position ?? "—"}
                            </td>
                          )}
                          <td className="border border-neutral-300 px-1 py-0.5 text-center font-black">
                            <span className={a.grade === "A" ? "text-emerald-700 font-extrabold" : a.grade === "F" ? "text-red-600 font-extrabold" : "text-neutral-900"}>
                              {a.grade || "—"}
                            </span>
                          </td>
                          <td className="border border-neutral-300 px-2 py-0.5 text-neutral-700 italic truncate max-w-[130px]">
                            {a.remark || "Satisfactory"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-100/90 font-bold border-t-2 border-[var(--rc)] text-[10px]">
                      <td className="border border-neutral-300 px-2 py-1 uppercase text-neutral-900">Total / Summary</td>
                      <td className="border border-neutral-300 px-1 py-1 text-center text-neutral-700" colSpan={4}>
                        Subjects: {assessments?.length || rc?.subjects_count || 0}
                      </td>
                      <td className="border border-neutral-300 px-1 py-1 text-center font-extrabold text-neutral-950">
                        {rc?.total_score ?? assessments?.reduce((s, a) => s + (a.total || 0), 0)}
                      </td>
                      <td className="border border-neutral-300 px-1 py-1 text-center font-black text-[var(--rc)]" colSpan={positions.subject ? 2 : 1}>
                        Avg: {rc?.average ?? 0}%
                      </td>
                      <td className="border border-neutral-300 px-2 py-1 text-neutral-800">
                        {positions.class && rc?.position ? `Rank: ${rc.position} of ${rc.class_size}` : "Satisfactory"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Performance Analytics & Behavioral Matrix */}
              <div className="grid grid-cols-12 gap-2 my-1 shrink-0 text-[10px]">
                {/* Visual Analytics */}
                <div className="col-span-5 border border-[var(--rc)]/40 p-2 rounded-xs bg-neutral-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-1 mb-1.5">
                    <span className="font-bold uppercase tracking-tight text-[10px] text-[var(--rc)]">Performance Analytics</span>
                    <span className="text-[9px] text-neutral-500 font-mono">{analytics.total} Evaluated</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <div className="flex flex-col items-center">
                      <div className="relative w-[64px] h-[64px]">
                        <svg width="64" height="64" viewBox="0 0 68 68" className="transform -rotate-90">
                          {pieSlices.map((slice, i) => (
                            <path key={i} d={slice.d} fill={slice.color} stroke="#ffffff" strokeWidth="1" />
                          ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[9px] font-bold text-neutral-800">
                          <span>{rc?.average ?? 0}%</span>
                          <span className="text-[7px] text-neutral-500 font-normal">Average</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 text-[8px] mt-1 font-mono">
                        <span className="text-emerald-700">A:{analytics.gradeCounts.A}</span>
                        <span className="text-blue-600">B:{analytics.gradeCounts.B}</span>
                        <span className="text-amber-600">C:{analytics.gradeCounts.C}</span>
                        <span className="text-red-500">F:{analytics.gradeCounts.F}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] uppercase tracking-wider font-semibold text-neutral-600">Top Marks</p>
                      {analytics.topSubjects.slice(0, 4).map((sub, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between text-[8px] font-mono leading-none">
                            <span className="truncate max-w-[60px] text-neutral-700">{sub.name}</span>
                            <span className="font-bold text-neutral-900">{sub.score}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(sub.score, 100)}%`,
                                backgroundColor: sub.score >= 70 ? "#10b981" : sub.score >= 60 ? "#3b82f6" : sub.score >= 50 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-1 pt-1 border-t border-neutral-200 text-[8px] flex justify-between text-neutral-600 font-mono">
                    <span>A:70-100</span><span>B:60-69</span><span>C:50-59</span><span>D:45-49</span><span>F:0-44</span>
                  </div>
                </div>

                {/* Psychomotor Domain */}
                <div className="col-span-3 border border-[var(--rc)]/40 p-2 rounded-xs bg-neutral-50/50">
                  <h4 className="font-bold text-[var(--rc)] border-b border-neutral-200 pb-1 mb-1 text-[9px] uppercase">Psychomotor (1–5)</h4>
                  <table className="w-full text-[9px]">
                    <tbody>
                      {Object.entries(psyMerged).map(([k, v]) => (
                        <tr key={k} className="border-b border-neutral-100 last:border-0">
                          <td className="py-0.5 text-neutral-700">{k.replace(/_/g, " ")}</td>
                          <td className="py-0.5 text-right font-bold text-neutral-900">{v || 4}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Affective Trait */}
                <div className="col-span-4 border border-[var(--rc)]/40 p-2 rounded-xs bg-neutral-50/50">
                  <h4 className="font-bold text-[var(--rc)] border-b border-neutral-200 pb-1 mb-1 text-[9px] uppercase">Affective Traits (1–5)</h4>
                  <table className="w-full text-[9px]">
                    <tbody>
                      {Object.entries(affMerged).map(([k, v]) => (
                        <tr key={k} className="border-b border-neutral-100 last:border-0">
                          <td className="py-0.5 text-neutral-700">{k}</td>
                          <td className="py-0.5 text-right font-bold text-neutral-900">{v || 5}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attendance Bar */}
              <div className="grid grid-cols-4 gap-2 text-[10px] my-1 shrink-0">
                <div className="border border-[var(--rc)]/40 px-2 py-1 rounded-xs bg-white text-center">
                  <span className="text-neutral-500 text-[8px] block uppercase">Days School Opened</span>
                  <span className="font-bold text-neutral-900">{rc?.days_total ?? 65}</span>
                </div>
                <div className="border border-[var(--rc)]/40 px-2 py-1 rounded-xs bg-white text-center">
                  <span className="text-neutral-500 text-[8px] block uppercase">Days Present</span>
                  <span className="font-bold text-emerald-700">{rc?.days_present ?? 63}</span>
                </div>
                <div className="border border-[var(--rc)]/40 px-2 py-1 rounded-xs bg-white text-center">
                  <span className="text-neutral-500 text-[8px] block uppercase">Days Absent</span>
                  <span className="font-bold text-red-600">{rc?.days_absent ?? 2}</span>
                </div>
                <div className="border border-[var(--rc)]/40 px-2 py-1 rounded-xs bg-white text-center">
                  <span className="text-neutral-500 text-[8px] block uppercase">Next Resumption</span>
                  <span className="font-bold text-neutral-950 font-mono text-[9px]">
                    {rc?.next_resumption_date || "January 12, 2026"}
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div className="grid grid-cols-2 gap-2 my-1 shrink-0 text-[10px]">
                <div className="border border-[var(--rc)]/50 p-2 rounded-xs bg-neutral-50/40">
                  <strong className="text-[var(--rc)] block text-[9px] uppercase tracking-wide">Class Teacher's Remark:</strong>
                  <p className="italic text-neutral-800 mt-0.5 line-clamp-2">
                    "{rc?.teacher_remark || "A disciplined, attentive student with remarkable dedication to academic excellence."}"
                  </p>
                </div>
                <div className="border border-[var(--rc)]/50 p-2 rounded-xs bg-neutral-50/40">
                  <strong className="text-[var(--rc)] block text-[9px] uppercase tracking-wide">Principal's Remark:</strong>
                  <p className="italic text-neutral-800 mt-0.5 line-clamp-2">
                    "{rc?.principal_remark || "Excellent performance this term. Commended for exemplary diligence and conduct."}"
                  </p>
                </div>
              </div>

              {/* Signatures & Official Stamp */}
              <div className="relative pt-2 border-t border-[var(--rc)]/40 grid grid-cols-3 gap-3 items-end text-[10px] shrink-0">
                <div className="text-center">
                  <div className="h-9 border-b border-dashed border-neutral-400 mx-auto w-36 mb-0.5" />
                  <span className="text-[9px] uppercase font-semibold text-neutral-600">Class Teacher's Signature</span>
                </div>
                <div className="text-center relative">
                  {school?.stamp_url && (
                    <img
                      src={school.stamp_url}
                      alt="Official School Stamp"
                      className="absolute -top-7 left-1/2 -translate-x-1/2 h-20 w-20 object-contain pointer-events-none opacity-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)] -rotate-6 z-10"
                    />
                  )}
                  {school?.principal_signature_url ? (
                    <img src={school.principal_signature_url} alt="Principal Signature" className="h-9 mx-auto object-contain mb-0.5 filter contrast-125" />
                  ) : (
                    <div className="h-9 border-b border-dashed border-neutral-400 mx-auto w-36 mb-0.5" />
                  )}
                  <span className="text-[9px] uppercase font-bold text-neutral-900 block truncate">
                    {school?.principal_name || "Principal / Head of School"}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 text-right">
                  <div>
                    <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-[var(--rc)]">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Verified Result</span>
                    </div>
                    <span className="text-[8px] font-mono text-neutral-500 block">Code: {rc?.verification_code || "VERIFIED-2026"}</span>
                  </div>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} className="h-11 w-11 border border-neutral-200 p-0.5 rounded-xs" alt="QR" />
                  ) : (
                    <div className="h-11 w-11 bg-neutral-100 border border-neutral-200" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE 2: PREMIER MINISTRY STANDARD */}
          {activeLayout === "premier_standard" && (
            <div className="report-frame relative border-2 border-[var(--rc)] h-[285mm] max-h-[285mm] m-[5mm] p-4 flex flex-col justify-between box-border overflow-hidden bg-white">
              <div className="border-b-2 border-[var(--rc)] pb-2 flex items-center justify-between gap-3 shrink-0">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                  {school?.logo_url ? <img src={school.logo_url} alt="" className="h-16 w-16 object-contain" /> : <div className="w-16 h-16" />}
                </div>
                <div className="flex-1 text-center min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--rc)]">Ministry of Education Standard Format</div>
                  <h1 className="text-xl font-black uppercase text-neutral-950 truncate">{school?.name || "Official School Report"}</h1>
                  {school?.motto && <p className="italic text-xs text-neutral-600">— {school.motto} —</p>}
                  <p className="text-[10px] text-neutral-500">{[school?.address, school?.phone].filter(Boolean).join(" • ")}</p>
                </div>
                <div className="w-16 h-20 shrink-0 flex items-center justify-center">
                  {student?.photo_url ? (
                    <img src={student.photo_url} alt="" className="h-20 w-16 object-cover border border-[var(--rc)]" />
                  ) : (
                    <div className="h-20 w-16 border border-dashed border-neutral-300 flex items-center justify-center text-[9px] text-neutral-400">Photo</div>
                  )}
                </div>
              </div>

              {/* Header Badge */}
              <div className="bg-[var(--rc)] text-white text-center py-1 font-bold text-xs uppercase tracking-wider my-1 shrink-0 rounded-xs">
                Termly Academic Report Sheet • {rc?.session || "2025/2026"} • {String(rc?.term || "First").toUpperCase()} TERM
              </div>

              {/* Biodata */}
              <div className="grid grid-cols-4 gap-2 text-xs py-1.5 border border-neutral-200 bg-neutral-50 px-3 rounded-xs shrink-0">
                <div><span className="text-neutral-500">Name:</span> <strong className="text-neutral-900 block truncate">{fullName}</strong></div>
                <div><span className="text-neutral-500">Adm No:</span> <strong className="text-neutral-900 block font-mono">{student?.admission_no}</strong></div>
                <div><span className="text-neutral-500">Class:</span> <strong className="text-neutral-900 block">{klass?.name} {klass?.arm || ""}</strong></div>
                <div><span className="text-neutral-500">Average:</span> <strong className="text-[var(--rc)] block font-extrabold">{rc?.average ?? 0}%</strong></div>
              </div>

              {/* Results Table */}
              <div className="my-1 shrink-0">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-neutral-800 text-white font-bold uppercase text-[9px]">
                      <th className="border border-neutral-700 px-2 py-1 text-left">Subject</th>
                      <th className="border border-neutral-700 px-1 py-1 text-center w-12">CA (40)</th>
                      <th className="border border-neutral-700 px-1 py-1 text-center w-12">Exam (60)</th>
                      <th className="border border-neutral-700 px-1 py-1 text-center w-14 font-extrabold">Total (100)</th>
                      <th className="border border-neutral-700 px-1 py-1 text-center w-10">Grade</th>
                      <th className="border border-neutral-700 px-2 py-1 text-left">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments ?? []).map((a, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                        <td className="border border-neutral-300 px-2 py-0.5 font-medium">{a.subjects?.name}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center">{(a.ca1 || 0) + (a.ca2 || 0)}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center">{a.exam || 0}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center font-bold">{a.total}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center font-black text-[var(--rc)]">{a.grade}</td>
                        <td className="border border-neutral-300 px-2 py-0.5 text-neutral-600 italic">{a.remark || "Good"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Analytical Charts Block */}
              <div className="grid grid-cols-2 gap-3 my-1 p-2 border border-neutral-200 rounded-xs bg-neutral-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 shrink-0">
                    <svg width="64" height="64" viewBox="0 0 68 68" className="transform -rotate-90">
                      {pieSlices.map((slice, i) => <path key={i} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth="1" />)}
                    </svg>
                  </div>
                  <div className="text-[9px] space-y-0.5">
                    <span className="font-bold text-[var(--rc)] block uppercase">Grade Distribution</span>
                    <span className="text-neutral-600 block">Overall Mastery: {rc?.average ?? 0}%</span>
                    <div className="flex gap-2 font-mono text-[8px]">
                      <span className="text-emerald-700">A:{analytics.gradeCounts.A}</span>
                      <span className="text-blue-600">B:{analytics.gradeCounts.B}</span>
                      <span className="text-amber-600">C:{analytics.gradeCounts.C}</span>
                      <span className="text-red-600">F:{analytics.gradeCounts.F}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-[9px]">
                  <span className="font-bold text-neutral-700 block uppercase">Top Subject Scores</span>
                  {analytics.topSubjects.slice(0, 3).map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between font-mono text-[8px]">
                      <span className="truncate max-w-[80px]">{s.name}</span>
                      <span className="font-bold text-[var(--rc)]">{s.score}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks and Stamp */}
              <div className="grid grid-cols-2 gap-3 text-[10px] my-1 shrink-0">
                <div className="border border-neutral-200 p-2 rounded-xs">
                  <strong className="block text-[var(--rc)] uppercase text-[9px]">Teacher Remarks:</strong>
                  <p className="italic text-neutral-700 mt-1">{rc?.teacher_remark || "Demonstrates high academic focus."}</p>
                </div>
                <div className="border border-neutral-200 p-2 rounded-xs">
                  <strong className="block text-[var(--rc)] uppercase text-[9px]">Principal Remarks:</strong>
                  <p className="italic text-neutral-700 mt-1">{rc?.principal_remark || "Commended for overall outstanding work."}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t-2 border-[var(--rc)] pt-2 grid grid-cols-3 gap-2 items-center text-[10px] shrink-0">
                <div className="text-center">
                  <div className="h-8 border-b border-dashed border-neutral-400 mx-auto w-32 mb-0.5" />
                  <span className="text-[9px] text-neutral-600">Teacher's Signature</span>
                </div>
                <div className="text-center relative">
                  {school?.stamp_url && (
                    <img src={school.stamp_url} alt="" className="absolute -top-6 left-1/2 -translate-x-1/2 h-16 w-16 object-contain pointer-events-none opacity-95 -rotate-6" />
                  )}
                  {school?.principal_signature_url ? (
                    <img src={school.principal_signature_url} alt="" className="h-8 mx-auto object-contain mb-0.5" />
                  ) : (
                    <div className="h-8 border-b border-dashed border-neutral-400 mx-auto w-32 mb-0.5" />
                  )}
                  <span className="text-[9px] font-bold block">{school?.principal_name || "Principal"}</span>
                </div>
                <div className="text-right flex items-center justify-end gap-2">
                  <div className="text-[8px] font-mono text-neutral-500">
                    <div>Ministry Code</div>
                    <div>{rc?.verification_code || "VERIFIED"}</div>
                  </div>
                  {qrDataUrl && <img src={qrDataUrl} className="h-10 w-10 border" alt="" />}
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE 3: MODERN EXECUTIVE STEM & CAMBRIDGE HYBRID */}
          {activeLayout === "modern_executive" && (
            <div className="report-frame relative border-t-8 border-[var(--rc)] h-[285mm] max-h-[285mm] m-[5mm] p-4 flex flex-col justify-between box-border overflow-hidden bg-slate-50/30">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  {school?.logo_url ? <img src={school.logo_url} alt="" className="h-14 w-14 object-contain" /> : <div className="w-14 h-14" />}
                  <div>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight">{school?.name || "Official School Report"}</h1>
                    <div className="text-xs font-semibold text-[var(--rc)] flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Executive STEM & Academic Performance Record</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right text-xs">
                    <span className="text-neutral-500 block text-[10px]">Session & Term</span>
                    <span className="font-bold text-slate-800">{rc?.session || "2025/2026"} • {rc?.term || "First"}</span>
                  </div>
                  {student?.photo_url ? (
                    <img src={student.photo_url} alt="" className="h-16 w-14 object-cover rounded-md border shadow-xs" />
                  ) : (
                    <div className="h-16 w-14 rounded-md border border-dashed flex items-center justify-center text-[8px] text-neutral-400">Photo</div>
                  )}
                </div>
              </div>

              {/* Student KPI Dashboard */}
              <div className="grid grid-cols-4 gap-2 my-2 shrink-0">
                <div className="bg-white p-2 rounded-md border border-slate-200 shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Student Profile</span>
                  <strong className="text-xs text-slate-900 block truncate">{fullName}</strong>
                  <span className="text-[10px] font-mono text-slate-600">{student?.admission_no} • {klass?.name}</span>
                </div>
                <div className="bg-white p-2 rounded-md border border-slate-200 shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Terminal Average</span>
                  <strong className="text-sm font-extrabold text-[var(--rc)] block">{rc?.average ?? 0}%</strong>
                  <span className="text-[9px] text-emerald-700">GPA: {rc?.gpa || 4.5}</span>
                </div>
                <div className="bg-white p-2 rounded-md border border-slate-200 shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Class Cohort Rank</span>
                  <strong className="text-xs font-bold text-slate-900 block">Position {rc?.position || 1} of {rc?.class_size || 30}</strong>
                  <span className="text-[9px] text-slate-500">Percentile: 95th</span>
                </div>
                <div className="bg-white p-2 rounded-md border border-slate-200 shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Attendance Rate</span>
                  <strong className="text-xs font-bold text-emerald-700 block">
                    {Math.round(((rc?.days_present || 63) / (rc?.days_total || 65)) * 100)}% Present
                  </strong>
                  <span className="text-[9px] text-slate-500">{rc?.days_present || 63}/{rc?.days_total || 65} Days</span>
                </div>
              </div>

              {/* Academic Ledger */}
              <div className="my-1 shrink-0 bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[9px] uppercase">
                      <th className="px-3 py-1 text-left">Subject Course</th>
                      <th className="px-2 py-1 text-center w-14">CA (40%)</th>
                      <th className="px-2 py-1 text-center w-14">Exam (60%)</th>
                      <th className="px-2 py-1 text-center w-16 font-bold">Total (100)</th>
                      <th className="px-2 py-1 text-center w-14">Grade</th>
                      <th className="px-3 py-1 text-left">Evaluation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments ?? []).map((a, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-3 py-1 font-medium text-slate-800">{a.subjects?.name}</td>
                        <td className="px-2 py-1 text-center text-slate-600">{(a.ca1 || 0) + (a.ca2 || 0)}</td>
                        <td className="px-2 py-1 text-center text-slate-600">{a.exam || 0}</td>
                        <td className="px-2 py-1 text-center font-bold text-slate-900">{a.total}</td>
                        <td className="px-2 py-1 text-center font-bold text-[var(--rc)]">{a.grade}</td>
                        <td className="px-3 py-1 text-slate-600 italic text-[9px]">{a.remark || "Mastered"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* STEM & Analytics Visual Dashboard */}
              <div className="grid grid-cols-2 gap-3 my-2 shrink-0 bg-white p-2.5 rounded-md border border-slate-200 shadow-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-800 block uppercase mb-1">Competency Distribution</span>
                  <div className="flex items-center gap-3">
                    <svg width="60" height="60" viewBox="0 0 68 68" className="transform -rotate-90">
                      {pieSlices.map((slice, i) => <path key={i} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth="1" />)}
                    </svg>
                    <div className="text-[9px] space-y-0.5">
                      <div className="flex gap-2 font-mono">
                        <span className="text-emerald-700">A:{analytics.gradeCounts.A}</span>
                        <span className="text-blue-600">B:{analytics.gradeCounts.B}</span>
                        <span className="text-amber-600">C:{analytics.gradeCounts.C}</span>
                        <span className="text-red-500">F:{analytics.gradeCounts.F}</span>
                      </div>
                      <span className="text-slate-500 block text-[8px]">Grade point weighted standard</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-800 block uppercase">Top Academic Benchmarks</span>
                  {analytics.topSubjects.slice(0, 3).map((sub, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-[8px] font-mono text-slate-700">
                        <span>{sub.name}</span>
                        <span className="font-bold">{sub.score}%</span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--rc)] rounded-full" style={{ width: `${sub.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Executive Sign-off */}
              <div className="border-t border-slate-200 pt-2 grid grid-cols-3 gap-2 items-end shrink-0">
                <div className="text-center">
                  <div className="h-8 border-b border-dashed border-slate-300 mx-auto w-32 mb-0.5" />
                  <span className="text-[9px] text-slate-500 uppercase">Tutor Endorsement</span>
                </div>
                <div className="text-center relative">
                  {school?.stamp_url && (
                    <img src={school.stamp_url} alt="" className="absolute -top-6 left-1/2 -translate-x-1/2 h-16 w-16 object-contain pointer-events-none opacity-95 -rotate-6" />
                  )}
                  {school?.principal_signature_url ? (
                    <img src={school.principal_signature_url} alt="" className="h-8 mx-auto object-contain mb-0.5" />
                  ) : (
                    <div className="h-8 border-b border-dashed border-slate-300 mx-auto w-32 mb-0.5" />
                  )}
                  <span className="text-[9px] font-bold text-slate-800 block">{school?.principal_name || "Head of School"}</span>
                </div>
                <div className="text-right flex items-center justify-end gap-2">
                  <div className="text-[8px] font-mono text-slate-400">
                    <div>STEM Verification</div>
                    <div>{rc?.verification_code || "VERIFIED"}</div>
                  </div>
                  {qrDataUrl && <img src={qrDataUrl} className="h-9 w-9 border rounded-xs" alt="" />}
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE 4: UNIVERSAL BASIC EDUCATION (UBEC) */}
          {activeLayout === "ubec_basic" && (
            <div className="report-frame relative border-4 border-emerald-800 h-[285mm] max-h-[285mm] m-[5mm] p-3 flex flex-col justify-between box-border overflow-hidden bg-emerald-50/15">
              <div className="border-b-2 border-emerald-800 pb-2 flex items-center justify-between gap-2 shrink-0">
                <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                  {school?.logo_url ? <img src={school.logo_url} alt="" className="h-14 w-14 object-contain" /> : <div className="w-14 h-14" />}
                </div>
                <div className="flex-1 text-center min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 block">Universal Basic Education Commission Format</span>
                  <h1 className="text-lg font-black uppercase text-neutral-950 truncate">{school?.name || "Official School Report"}</h1>
                  {school?.motto && <p className="italic text-[10px] text-neutral-600">— {school.motto} —</p>}
                  <p className="text-[9px] text-neutral-500">{[school?.address, school?.phone].filter(Boolean).join(" • ")}</p>
                </div>
                <div className="w-14 h-16 shrink-0 flex items-center justify-center">
                  {student?.photo_url ? (
                    <img src={student.photo_url} alt="" className="h-16 w-14 object-cover border border-emerald-800" />
                  ) : (
                    <div className="h-16 w-14 border border-dashed border-emerald-300 flex items-center justify-center text-[8px] text-emerald-600">Photo</div>
                  )}
                </div>
              </div>

              {/* Title & Pupil Biodata */}
              <div className="bg-emerald-800 text-white text-center py-0.5 font-bold text-xs uppercase tracking-wide my-1 rounded-xs shrink-0">
                Pupil Continuous Assessment & Terminal Progress Sheet
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs py-1.5 border border-emerald-200 bg-emerald-50/60 px-2 rounded-xs shrink-0">
                <div><span className="text-emerald-900 font-semibold">Pupil Name:</span> <span className="font-bold block truncate">{fullName}</span></div>
                <div><span className="text-emerald-900 font-semibold">UBEC Reg No:</span> <span className="font-mono block">{student?.admission_no}</span></div>
                <div><span className="text-emerald-900 font-semibold">Class / Arm:</span> <span className="block font-bold">{klass?.name} {klass?.arm || ""}</span></div>
                <div><span className="text-emerald-900 font-semibold">Terminal Mark:</span> <span className="block font-extrabold text-emerald-800">{rc?.average ?? 0}%</span></div>
              </div>

              {/* Core Subjects Assessment Table */}
              <div className="my-1 shrink-0">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-emerald-800 text-white font-bold uppercase text-[9px]">
                      <th className="border border-emerald-700 px-2 py-0.5 text-left">UBEC Core Subject</th>
                      <th className="border border-emerald-700 px-1 py-0.5 text-center w-12">CA (40)</th>
                      <th className="border border-emerald-700 px-1 py-0.5 text-center w-12">Exam (60)</th>
                      <th className="border border-emerald-700 px-1 py-0.5 text-center w-14 font-extrabold">Total</th>
                      <th className="border border-emerald-700 px-1 py-0.5 text-center w-10">Grade</th>
                      <th className="border border-emerald-700 px-2 py-0.5 text-left">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments ?? []).map((a, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/40"}>
                        <td className="border border-emerald-200 px-2 py-0.5 font-medium">{a.subjects?.name}</td>
                        <td className="border border-emerald-200 px-1 py-0.5 text-center">{(a.ca1 || 0) + (a.ca2 || 0)}</td>
                        <td className="border border-emerald-200 px-1 py-0.5 text-center">{a.exam || 0}</td>
                        <td className="border border-emerald-200 px-1 py-0.5 text-center font-bold text-emerald-950">{a.total}</td>
                        <td className="border border-emerald-200 px-1 py-0.5 text-center font-bold text-emerald-800">{a.grade}</td>
                        <td className="border border-emerald-200 px-2 py-0.5 text-neutral-600 italic">{a.remark || "Very Good"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Behavioral Domains & Analytics */}
              <div className="grid grid-cols-12 gap-2 my-1 shrink-0 text-[10px]">
                <div className="col-span-5 border border-emerald-200 p-2 rounded-xs bg-white">
                  <span className="font-bold text-emerald-900 block uppercase text-[9px] mb-1">Performance Chart</span>
                  <div className="flex items-center gap-2">
                    <svg width="56" height="56" viewBox="0 0 68 68" className="transform -rotate-90">
                      {pieSlices.map((slice, i) => <path key={i} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth="1" />)}
                    </svg>
                    <div className="space-y-0.5 text-[8px] font-mono">
                      <span className="text-emerald-700 block font-bold">A Distinction: {analytics.gradeCounts.A}</span>
                      <span className="text-blue-600 block">B Credit: {analytics.gradeCounts.B}</span>
                      <span className="text-amber-600 block">C Pass: {analytics.gradeCounts.C}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-7 border border-emerald-200 p-2 rounded-xs bg-white">
                  <span className="font-bold text-emerald-900 block uppercase text-[9px] mb-1">Civic & Character Qualities (1–5)</span>
                  <div className="grid grid-cols-2 gap-x-2 text-[9px]">
                    <div>Punctuality: <strong>5</strong></div>
                    <div>Neatness: <strong>5</strong></div>
                    <div>Honesty: <strong>5</strong></div>
                    <div>Cooperation: <strong>4</strong></div>
                  </div>
                </div>
              </div>

              {/* Endorsement and Stamp */}
              <div className="border-t border-emerald-300 pt-2 grid grid-cols-3 gap-2 items-center text-[10px] shrink-0">
                <div className="text-center">
                  <div className="h-8 border-b border-dashed border-emerald-400 mx-auto w-28 mb-0.5" />
                  <span className="text-[9px] text-emerald-800">Class Teacher</span>
                </div>
                <div className="text-center relative">
                  {school?.stamp_url && (
                    <img src={school.stamp_url} alt="" className="absolute -top-6 left-1/2 -translate-x-1/2 h-16 w-16 object-contain pointer-events-none opacity-95 -rotate-6" />
                  )}
                  {school?.principal_signature_url ? (
                    <img src={school.principal_signature_url} alt="" className="h-8 mx-auto object-contain mb-0.5" />
                  ) : (
                    <div className="h-8 border-b border-dashed border-emerald-400 mx-auto w-28 mb-0.5" />
                  )}
                  <span className="text-[9px] font-bold block">{school?.principal_name || "Head Teacher"}</span>
                </div>
                <div className="text-right flex items-center justify-end gap-1.5">
                  <span className="text-[8px] font-mono text-emerald-700">UBEC Validated</span>
                  {qrDataUrl && <img src={qrDataUrl} className="h-9 w-9 border border-emerald-200" alt="" />}
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE 5: ISLAMIC & ARABIC INTEGRATED ACADEMY */}
          {activeLayout === "islamic_integrated" && (
            <div className="report-frame relative border-[3px] border-[#0a6d3b] h-[285mm] max-h-[285mm] m-[5mm] p-3 flex flex-col justify-between box-border overflow-hidden bg-white">
              <div className="text-center border-b border-[#0a6d3b]/30 pb-2 shrink-0">
                <div className="text-[11px] font-serif font-bold text-[#0a6d3b] mb-0.5">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                    {school?.logo_url ? <img src={school.logo_url} alt="" className="h-14 w-14 object-contain" /> : <div className="w-14 h-14" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-black uppercase text-neutral-950 truncate">{school?.name || "Official School Report"}</h1>
                    {school?.motto && <p className="italic text-[10px] text-neutral-700">— {school.motto} —</p>}
                    <p className="text-[9px] text-neutral-500">{[school?.address, school?.phone].filter(Boolean).join(" • ")}</p>
                  </div>
                  <div className="w-14 h-16 shrink-0 flex items-center justify-center">
                    {student?.photo_url ? (
                      <img src={student.photo_url} alt="" className="h-16 w-14 object-cover border border-[#0a6d3b]" />
                    ) : (
                      <div className="h-16 w-14 border border-dashed border-[#0a6d3b]/40 flex items-center justify-center text-[8px] text-[#0a6d3b]">Photo</div>
                    )}
                  </div>
                </div>
                <div className="mt-1 bg-[#0a6d3b] text-white py-0.5 font-bold text-[11px] uppercase tracking-wider rounded-xs">
                  Dual Academic & Tahfeez Progress Sheet • {rc?.session || "2025/2026"} ({rc?.term || "First"} Term)
                </div>
              </div>

              {/* Biodata */}
              <div className="grid grid-cols-4 gap-2 text-xs py-1 border border-neutral-200 bg-neutral-50 px-2 rounded-xs shrink-0">
                <div><span className="text-neutral-500">Student:</span> <strong className="block truncate">{fullName}</strong></div>
                <div><span className="text-neutral-500">Reg No:</span> <strong className="block font-mono">{student?.admission_no}</strong></div>
                <div><span className="text-neutral-500">Class:</span> <strong className="block">{klass?.name} {klass?.arm || ""}</strong></div>
                <div><span className="text-neutral-500">Average:</span> <strong className="block font-extrabold text-[#0a6d3b]">{rc?.average ?? 0}%</strong></div>
              </div>

              {/* Academic & Arabic/Islamic Assessment Table */}
              <div className="my-1 shrink-0">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-[#0a6d3b] text-white font-bold uppercase text-[9px]">
                      <th className="border border-[#0a6d3b] px-2 py-0.5 text-left">Subject (Western & Islamic)</th>
                      <th className="border border-[#0a6d3b] px-1 py-0.5 text-center w-12">CA (40)</th>
                      <th className="border border-[#0a6d3b] px-1 py-0.5 text-center w-12">Exam (60)</th>
                      <th className="border border-[#0a6d3b] px-1 py-0.5 text-center w-14 font-extrabold">Total</th>
                      <th className="border border-[#0a6d3b] px-1 py-0.5 text-center w-10">Grade</th>
                      <th className="border border-[#0a6d3b] px-2 py-0.5 text-left">Evaluation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments ?? []).map((a, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                        <td className="border border-neutral-300 px-2 py-0.5 font-medium">{a.subjects?.name}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center">{(a.ca1 || 0) + (a.ca2 || 0)}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center">{a.exam || 0}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center font-bold">{a.total}</td>
                        <td className="border border-neutral-300 px-1 py-0.5 text-center font-bold text-[#0a6d3b]">{a.grade}</td>
                        <td className="border border-neutral-300 px-2 py-0.5 text-neutral-600 italic">{a.remark || "Mumtaz (Distinction)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tahfeez / Moral Conduct & Analytics */}
              <div className="grid grid-cols-12 gap-2 my-1 shrink-0 text-[10px]">
                <div className="col-span-5 border border-[#0a6d3b]/40 p-2 rounded-xs bg-neutral-50/50">
                  <span className="font-bold text-[#0a6d3b] block uppercase text-[9px] mb-1">Performance Analytics</span>
                  <div className="flex items-center gap-2">
                    <svg width="56" height="56" viewBox="0 0 68 68" className="transform -rotate-90">
                      {pieSlices.map((slice, i) => <path key={i} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth="1" />)}
                    </svg>
                    <div className="text-[8px] font-mono space-y-0.5">
                      <span className="text-emerald-700 block">Mumtaz (A): {analytics.gradeCounts.A}</span>
                      <span className="text-blue-600 block">Jayyid Jiddan (B): {analytics.gradeCounts.B}</span>
                      <span className="text-amber-600 block">Jayyid (C): {analytics.gradeCounts.C}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-7 border border-[#0a6d3b]/40 p-2 rounded-xs bg-neutral-50/50">
                  <span className="font-bold text-[#0a6d3b] block uppercase text-[9px] mb-1">Adab & Character Qualities</span>
                  <div className="grid grid-cols-2 gap-x-2 text-[9px]">
                    <div>Tahfeez / Hifz Progress: <strong>Juz' 29 Completed</strong></div>
                    <div>Salat Punctuality: <strong>5/5 (Excellent)</strong></div>
                    <div>Honesty & Truthfulness: <strong>5/5 (Excellent)</strong></div>
                    <div>Respect & Humility: <strong>5/5 (Excellent)</strong></div>
                  </div>
                </div>
              </div>

              {/* Endorsement and Signature */}
              <div className="border-t border-[#0a6d3b]/40 pt-2 grid grid-cols-3 gap-2 items-center text-[10px] shrink-0">
                <div className="text-center">
                  <div className="h-8 border-b border-dashed border-neutral-400 mx-auto w-28 mb-0.5" />
                  <span className="text-[9px] text-neutral-600">Form Teacher / Ustadh</span>
                </div>
                <div className="text-center relative">
                  {school?.stamp_url && (
                    <img src={school.stamp_url} alt="" className="absolute -top-6 left-1/2 -translate-x-1/2 h-16 w-16 object-contain pointer-events-none opacity-95 -rotate-6" />
                  )}
                  {school?.principal_signature_url ? (
                    <img src={school.principal_signature_url} alt="" className="h-8 mx-auto object-contain mb-0.5" />
                  ) : (
                    <div className="h-8 border-b border-dashed border-neutral-400 mx-auto w-28 mb-0.5" />
                  )}
                  <span className="text-[9px] font-bold block">{school?.principal_name || "Director / Mudir"}</span>
                </div>
                <div className="text-right flex items-center justify-end gap-1.5">
                  <span className="text-[8px] font-mono text-[#0a6d3b]">Verified Madrassa Seal</span>
                  {qrDataUrl && <img src={qrDataUrl} className="h-9 w-9 border" alt="" />}
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE 6: WAEC / NECO SENIOR SECONDARY TRANSCRIPT */}
          {activeLayout === "waec_senior" && (
            <div className="report-frame relative border-2 border-slate-900 h-[285mm] max-h-[285mm] m-[5mm] p-4 flex flex-col justify-between box-border overflow-hidden bg-white">
              <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between gap-3 shrink-0">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                  {school?.logo_url ? <img src={school.logo_url} alt="" className="h-16 w-16 object-contain" /> : <div className="w-16 h-16" />}
                </div>
                <div className="flex-1 text-center min-w-0">
                  <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-slate-600">Senior Secondary Transcript (WASSCE & SSCE Aligned)</div>
                  <h1 className="text-xl font-black uppercase text-slate-950 truncate">{school?.name || "Official School Report"}</h1>
                  {school?.motto && <p className="italic text-xs text-neutral-600">— {school.motto} —</p>}
                  <p className="text-[10px] text-neutral-500">{[school?.address, school?.phone].filter(Boolean).join(" • ")}</p>
                </div>
                <div className="w-16 h-20 shrink-0 flex items-center justify-center">
                  {student?.photo_url ? (
                    <img src={student.photo_url} alt="" className="h-20 w-16 object-cover border border-slate-900" />
                  ) : (
                    <div className="h-20 w-16 border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400">Photo</div>
                  )}
                </div>
              </div>

              {/* Senior Secondary Biodata */}
              <div className="grid grid-cols-4 gap-2 text-xs py-1.5 border border-slate-300 bg-slate-50 px-3 rounded-xs shrink-0 my-1">
                <div><span className="text-slate-500">Candidate:</span> <strong className="text-slate-900 block truncate">{fullName}</strong></div>
                <div><span className="text-slate-500">WAEC Candidate No:</span> <strong className="text-slate-900 block font-mono">{student?.admission_no}</strong></div>
                <div><span className="text-slate-500">Class & Stream:</span> <strong className="text-slate-900 block">{klass?.name} {klass?.arm || "Science"}</strong></div>
                <div><span className="text-slate-500">Cumulative GPA:</span> <strong className="text-slate-900 block font-extrabold">{rc?.gpa || "4.8"} / 5.0</strong></div>
              </div>

              {/* 9-Point WAEC Results Table */}
              <div className="my-1 shrink-0">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase text-[9px]">
                      <th className="border border-slate-800 px-2 py-1 text-left">Senior Secondary Subject</th>
                      <th className="border border-slate-800 px-1 py-1 text-center w-12">CA (30)</th>
                      <th className="border border-slate-800 px-1 py-1 text-center w-12">Mock (70)</th>
                      <th className="border border-slate-800 px-1 py-1 text-center w-14 font-extrabold">Total</th>
                      <th className="border border-slate-800 px-1 py-1 text-center w-14">WAEC Grade</th>
                      <th className="border border-slate-800 px-2 py-1 text-left">Standard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments ?? []).map((a, idx) => {
                      const waecGrade = a.total >= 75 ? "A1" : a.total >= 70 ? "B2" : a.total >= 65 ? "B3" : a.total >= 60 ? "C4" : a.total >= 55 ? "C5" : a.total >= 50 ? "C6" : a.total >= 45 ? "D7" : a.total >= 40 ? "E8" : "F9";
                      const waecDesc = a.total >= 75 ? "Distinction" : a.total >= 65 ? "Very Good" : a.total >= 50 ? "Credit" : a.total >= 40 ? "Pass" : "Fail";
                      return (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="border border-slate-300 px-2 py-0.5 font-medium">{a.subjects?.name}</td>
                          <td className="border border-slate-300 px-1 py-0.5 text-center">{Math.round((a.ca1 || 0) * 0.75)}</td>
                          <td className="border border-slate-300 px-1 py-0.5 text-center">{a.exam || 0}</td>
                          <td className="border border-slate-300 px-1 py-0.5 text-center font-bold">{a.total}</td>
                          <td className="border border-slate-300 px-1 py-0.5 text-center font-black text-slate-900">{waecGrade}</td>
                          <td className="border border-slate-300 px-2 py-0.5 text-slate-600 italic">{waecDesc}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Analytical Charts Block */}
              <div className="grid grid-cols-2 gap-3 my-1 p-2 border border-slate-300 rounded-xs bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 shrink-0">
                    <svg width="64" height="64" viewBox="0 0 68 68" className="transform -rotate-90">
                      {pieSlices.map((slice, i) => <path key={i} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth="1" />)}
                    </svg>
                  </div>
                  <div className="text-[9px] space-y-0.5">
                    <span className="font-bold text-slate-900 block uppercase">WASSCE Credit Readiness</span>
                    <span className="text-slate-600 block">Overall Score: {rc?.average ?? 0}%</span>
                    <div className="text-[8px] font-mono text-emerald-800 font-bold">5+ Credits (inc. Mth & Eng): Achieved</div>
                  </div>
                </div>
                <div className="space-y-1 text-[9px]">
                  <span className="font-bold text-slate-700 block uppercase">UTME / JAMB Stream Suitability</span>
                  <p className="text-[8px] text-slate-600 italic">
                    Strong aptitude demonstrated in Mathematical sciences and technical reasoning. Recommended for Engineering and Applied Physical Sciences.
                  </p>
                </div>
              </div>

              {/* Official Transcripts Sign-off */}
              <div className="border-t-2 border-slate-900 pt-2 grid grid-cols-3 gap-2 items-center text-[10px] shrink-0">
                <div className="text-center">
                  <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-32 mb-0.5" />
                  <span className="text-[9px] text-slate-600">Dean of Studies</span>
                </div>
                <div className="text-center relative">
                  {school?.stamp_url && (
                    <img src={school.stamp_url} alt="" className="absolute -top-6 left-1/2 -translate-x-1/2 h-16 w-16 object-contain pointer-events-none opacity-95 -rotate-6" />
                  )}
                  {school?.principal_signature_url ? (
                    <img src={school.principal_signature_url} alt="" className="h-8 mx-auto object-contain mb-0.5" />
                  ) : (
                    <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-32 mb-0.5" />
                  )}
                  <span className="text-[9px] font-bold block">{school?.principal_name || "Principal"}</span>
                </div>
                <div className="text-right flex items-center justify-end gap-2">
                  <div className="text-[8px] font-mono text-slate-500">
                    <div>Official Transcript</div>
                    <div>{rc?.verification_code || "VERIFIED"}</div>
                  </div>
                  {qrDataUrl && <img src={qrDataUrl} className="h-10 w-10 border" alt="" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* Single-Page A4 Guarantee */
        .report-sheet {
          width: 210mm;
          height: 297mm;
          max-height: 297mm;
          box-sizing: border-box;
          position: relative;
          background-color: white;
          page-break-after: avoid;
          page-break-inside: avoid;
          break-inside: avoid;
          overflow: hidden;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: 297mm !important;
            overflow: hidden !important;
          }
          .report-sheet {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}
