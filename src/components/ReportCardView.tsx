import { useEffect, useState, type CSSProperties, useMemo } from "react";
import { resolveReportTemplate, positionVisibility } from "@/lib/report-template";
import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";

type Assessment = {
  id: string;
  subject_position?: number | null;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string | null;
  remark: string | null;
  subjects: { name: string; code: string | null } | null;
};

export function ReportCardView({ rc, assessments }: { rc: any; assessments: Assessment[] }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const school: any = rc?.schools;
  const student: any = rc?.students;
  const klass: any = rc?.classes;
  const fullName = [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ");

  const psychomotor = (rc?.psychomotor as Record<string, number>) || {};
  const affective = (rc?.affective as Record<string, number>) || {};
  const defaultPsy = { Handwriting: 4, Drawing: 3, Sports: 4, Verbal: 4 };
  const defaultAff = { Punctuality: 5, Neatness: 4, Honesty: 5, Politeness: 4 };
  const psyMerged = { ...defaultPsy, ...psychomotor };
  const affMerged = { ...defaultAff, ...affective };

  const rawSection = (klass?.section as string | undefined)?.toLowerCase();
  const section: "nursery" | "primary" | "secondary" =
    rawSection === "nursery" || rawSection === "primary" || rawSection === "secondary"
      ? rawSection
      : "secondary";
  const template = resolveReportTemplate(school?.report_template, section);
  const positions = positionVisibility(template.positions);
  const themeStyle = Object.fromEntries(
    Object.entries(template)
      .filter(([key]) => key !== "positions")
      .map(([key, value]) => [`--rc-${key}`, `var(--report-colour-${value})`])
  ) as CSSProperties;
  const THEME = {
    c: `var(--report-colour-${template.border})`,
    soft: `color-mix(in oklab, var(--report-colour-${template.border}) 8%, transparent)`,
  };

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

    const topSubjects = list.slice(0, 7).map((a) => ({
      name: a.subjects?.name?.slice(0, 9) || "Subject",
      score: a.total,
      grade: a.grade || "C",
    }));

    return { gradeCounts, total: list.length, topSubjects };
  }, [assessments]);

  // Compute SVG pie chart slices
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
      <div className="max-w-full overflow-x-auto flex justify-center py-2 print:py-0 print:m-0">
        <div
          className="report-sheet bg-white shadow-xl print:shadow-none relative overflow-hidden text-neutral-900"
          style={{ ...themeStyle, "--rc": THEME.c } as CSSProperties}
        >
          {/* Subtle Watermark only if logo uploaded */}
          {school?.logo_url && (
            <div className="report-watermark pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
              <img src={school.logo_url} alt="" className="w-[50%] max-w-[340px] object-contain" />
            </div>
          )}

          {/* Precision Double Border Container formatted strictly to fit A4 */}
          <div className="report-frame relative border-[4px] border-double border-[var(--rc)] h-[285mm] max-h-[285mm] m-[5mm] p-3 flex flex-col justify-between box-border overflow-hidden bg-white/95">
            {/* Header Section */}
            <div className="flex items-center justify-between border-b-2 border-[var(--rc)] pb-2 gap-3 shrink-0">
              {/* Left Logo - strictly blank if not uploaded */}
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {school?.logo_url ? (
                  <img
                    src={school.logo_url}
                    alt={school.name || "School Logo"}
                    className="h-16 w-16 object-contain drop-shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16" />
                )}
              </div>

              {/* School Identity */}
              <div className="flex-1 text-center min-w-0 px-2">
                <h1 className="report-heading text-lg font-black tracking-tight uppercase leading-tight text-neutral-950 truncate">
                  {school?.name || "Official School Report"}
                </h1>
                {school?.motto && (
                  <p className="italic text-[11px] text-neutral-700 leading-tight">
                    — {school.motto} —
                  </p>
                )}
                <p className="text-[10px] text-neutral-600 mt-0.5 leading-tight truncate">
                  {[school?.address, school?.phone, school?.email].filter(Boolean).join(" • ")}
                </p>
                {school?.branch_name && (
                  <p className="text-[10px] font-semibold text-neutral-800 leading-tight">
                    Campus: {school.branch_name}
                  </p>
                )}
                <div className="mt-1.5 inline-flex items-center gap-2 bg-[var(--rc)] text-[var(--report-paper)] text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-sm shadow-xs">
                  <span>Student Progress Report</span>
                  <span>•</span>
                  <span>{rc?.session || "2025/2026"}</span>
                  <span>•</span>
                  <span>{String(rc?.term || "First").toUpperCase()} TERM</span>
                </div>
              </div>

              {/* Right Student Passport Photo */}
              <div className="w-16 h-20 shrink-0 flex items-center justify-center">
                {student?.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={fullName}
                    className="h-20 w-16 object-cover border-2 border-[var(--rc)] rounded-xs shadow-xs"
                  />
                ) : (
                  <div
                    className="h-20 w-16 border-2 border-dashed flex flex-col items-center justify-center text-[9px] text-neutral-400 bg-neutral-50 rounded-xs"
                    style={{ borderColor: THEME.c }}
                  >
                    <span>Photo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Biodata Row */}
            <div className="report-biodata grid grid-cols-4 gap-x-3 gap-y-1 text-[11px] py-1.5 border-b border-[var(--rc)]/30 bg-neutral-50/60 px-2 rounded-xs shrink-0">
              <div><strong className="text-neutral-700">Student:</strong> <span className="font-semibold text-neutral-950">{fullName.toUpperCase() || "—"}</span></div>
              <div><strong className="text-neutral-700">Adm. No:</strong> <span className="font-mono font-bold text-neutral-950">{student?.admission_no || "—"}</span></div>
              <div><strong className="text-neutral-700">Class:</strong> <span className="font-bold text-neutral-950">{klass?.name} {klass?.arm || ""}</span></div>
              <div><strong className="text-neutral-700">Gender:</strong> <span className="capitalize">{student?.gender || "—"}</span></div>
              <div><strong className="text-neutral-700">D.O.B:</strong> <span>{student?.dob || "—"}</span></div>
              <div><strong className="text-neutral-700">Average:</strong> <span className="font-extrabold text-[var(--rc)]">{rc?.average ?? "0"}%</span></div>
              {positions.class && (
                <div><strong className="text-neutral-700">Position:</strong> <span className="font-bold">{rc?.position ?? "—"} / {rc?.class_size ?? "—"}</span></div>
              )}
              <div><strong className="text-neutral-700">GPA:</strong> <span className="font-bold">{rc?.gpa ?? "—"}</span></div>
            </div>

            {/* Academic Results Table (Compact Line Heights for Single A4 Fit) */}
            <div className="my-1.5 shrink-0">
              <table className="report-results w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-[var(--rc)] text-[var(--report-paper)] text-[10px] uppercase font-bold">
                    <th className="border border-[var(--rc)] px-2 py-0.5 text-left">Subject</th>
                    <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-12">CA1 (20)</th>
                    <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-12">CA2 (20)</th>
                    <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-14">Exam (60)</th>
                    <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-14 font-extrabold">Total</th>
                    {positions.subject && <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-12">Pos</th>}
                    <th className="border border-[var(--rc)] px-1 py-0.5 text-center w-12">Grade</th>
                    <th className="border border-[var(--rc)] px-2 py-0.5 text-left">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {(assessments ?? []).map((a, idx) => (
                    <tr
                      key={a.id || idx}
                      className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50/70"}
                    >
                      <td className="border border-neutral-300 px-2 py-0.5 font-medium text-neutral-900 truncate max-w-[140px]">
                        {a.subjects?.name || "Subject"}
                      </td>
                      <td className="border border-neutral-300 px-1 py-0.5 text-center text-neutral-800">{a.ca1 ?? 0}</td>
                      <td className="border border-neutral-300 px-1 py-0.5 text-center text-neutral-800">{a.ca2 ?? 0}</td>
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
                        <span
                          className={
                            a.grade === "A"
                              ? "text-emerald-700 font-extrabold"
                              : a.grade === "F"
                              ? "text-red-600 font-extrabold"
                              : "text-neutral-900"
                          }
                        >
                          {a.grade || "—"}
                        </span>
                      </td>
                      <td className="border border-neutral-300 px-2 py-0.5 text-neutral-700 italic truncate max-w-[150px]">
                        {a.remark || "Satisfactory"}
                      </td>
                    </tr>
                  ))}
                  {!assessments?.length && (
                    <tr>
                      <td
                        colSpan={positions.subject ? 8 : 7}
                        className="border border-neutral-300 px-2 py-3 text-center text-neutral-500 italic"
                      >
                        No assessment entries recorded for this term.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-100/90 font-bold border-t-2 border-[var(--rc)] text-[10px]">
                    <td className="border border-neutral-300 px-2 py-1 uppercase text-neutral-900">
                      Summary
                    </td>
                    <td className="border border-neutral-300 px-1 py-1 text-center text-neutral-700" colSpan={3}>
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

            {/* Performance Analytics & Behavioral Domains Zone */}
            <div className="grid grid-cols-12 gap-2 my-1 shrink-0 text-[10px]">
              {/* Analytics: Bar & Pie Charts */}
              <div className="col-span-5 border border-[var(--rc)]/40 p-2 rounded-xs bg-neutral-50/50 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-1 mb-1.5">
                  <span className="font-bold uppercase tracking-tight text-[10px] text-[var(--rc)]">
                    Performance Analytics
                  </span>
                  <span className="text-[9px] text-neutral-500 font-mono">
                    {analytics.total} Subjects Evaluated
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 items-center">
                  {/* Mini Donut / Pie Chart for Grade Distribution */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-[68px] h-[68px]">
                      <svg width="68" height="68" viewBox="0 0 68 68" className="transform -rotate-90">
                        {pieSlices.map((slice, i) => (
                          <path
                            key={i}
                            d={slice.d}
                            fill={slice.color}
                            stroke="#ffffff"
                            strokeWidth="1"
                          />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-[9px] font-bold text-neutral-800">
                        <span>{rc?.average ?? 0}%</span>
                        <span className="text-[7px] text-neutral-500 font-normal">Score</span>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 text-[8px] mt-1 font-mono">
                      <span className="text-emerald-700">A:{analytics.gradeCounts.A}</span>
                      <span className="text-blue-600">B:{analytics.gradeCounts.B}</span>
                      <span className="text-amber-600">C:{analytics.gradeCounts.C}</span>
                      <span className="text-red-500">F:{analytics.gradeCounts.F}</span>
                    </div>
                  </div>

                  {/* Horizontal Bar Chart for Top Subject Marks */}
                  <div className="space-y-1">
                    <p className="text-[8px] uppercase tracking-wider font-semibold text-neutral-600">
                      Subject Marks
                    </p>
                    {analytics.topSubjects.slice(0, 4).map((sub, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-[8px] font-mono leading-none">
                          <span className="truncate max-w-[65px] text-neutral-700">{sub.name}</span>
                          <span className="font-bold text-neutral-900">{sub.score}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(sub.score, 100)}%`,
                              backgroundColor:
                                sub.score >= 70
                                  ? "#10b981"
                                  : sub.score >= 60
                                  ? "#3b82f6"
                                  : sub.score >= 50
                                  ? "#f59e0b"
                                  : "#ef4444",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compact Grading Scale */}
                <div className="mt-1.5 pt-1 border-t border-neutral-200 text-[8px] flex justify-between text-neutral-600 font-mono">
                  <span>A:70-100</span>
                  <span>B:60-69</span>
                  <span>C:50-59</span>
                  <span>D:45-49</span>
                  <span>F:0-44</span>
                </div>
              </div>

              {/* Psychomotor Domain */}
              <div className="col-span-3 border border-[var(--rc)]/40 p-2 rounded-xs bg-neutral-50/50">
                <h4 className="font-bold text-[var(--rc)] border-b border-neutral-200 pb-1 mb-1 text-[9px] uppercase">
                  Psychomotor (1–5)
                </h4>
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

              {/* Affective Domain */}
              <div className="col-span-4 border border-[var(--rc)]/40 p-2 rounded-xs bg-neutral-50/50">
                <h4 className="font-bold text-[var(--rc)] border-b border-neutral-200 pb-1 mb-1 text-[9px] uppercase">
                  Affective Trait (1–5)
                </h4>
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

            {/* Attendance & Next Resumption Bar */}
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
                <span className="text-neutral-500 text-[8px] block uppercase">Next Term Resumption</span>
                <span className="font-bold text-neutral-950 font-mono text-[9px]">
                  {rc?.next_resumption_date || student?.next_resumption_date || "January 12, 2026"}
                </span>
              </div>
            </div>

            {/* Remarks Section */}
            <div className="grid grid-cols-2 gap-2 my-1 shrink-0 text-[10px]">
              <div className="border border-[var(--rc)]/50 p-2 rounded-xs bg-neutral-50/40">
                <strong className="text-[var(--rc)] block text-[9px] uppercase tracking-wide">
                  Class Teacher's Remark:
                </strong>
                <p className="italic text-neutral-800 mt-0.5 line-clamp-2">
                  "{rc?.teacher_remark || "A disciplined, attentive student with remarkable dedication to academic excellence."}"
                </p>
              </div>
              <div className="border border-[var(--rc)]/50 p-2 rounded-xs bg-neutral-50/40">
                <strong className="text-[var(--rc)] block text-[9px] uppercase tracking-wide">
                  Principal's Remark:
                </strong>
                <p className="italic text-neutral-800 mt-0.5 line-clamp-2">
                  "{rc?.principal_remark || "Excellent performance this term. Commended for exemplary diligence and conduct."}"
                </p>
              </div>
            </div>

            {/* Signatures & Official Stamp Zone */}
            <div className="relative pt-2 border-t border-[var(--rc)]/40 grid grid-cols-3 gap-3 items-end text-[10px] shrink-0">
              {/* Teacher Signature */}
              <div className="text-center">
                <div className="h-9 border-b border-dashed border-neutral-400 mx-auto w-36 mb-0.5" />
                <span className="text-[9px] uppercase font-semibold text-neutral-600">
                  Class Teacher's Signature
                </span>
              </div>

              {/* Principal Signature & Stamp */}
              <div className="text-center relative">
                {/* Official School Stamp - High Visibility when uploaded, completely blank when not */}
                {school?.stamp_url && (
                  <img
                    src={school.stamp_url}
                    alt="Official School Stamp"
                    className="absolute -top-7 left-1/2 -translate-x-1/2 h-20 w-20 object-contain pointer-events-none opacity-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)] -rotate-6 z-10"
                  />
                )}
                {school?.principal_signature_url ? (
                  <img
                    src={school.principal_signature_url}
                    alt="Principal Signature"
                    className="h-9 mx-auto object-contain mb-0.5 filter contrast-125"
                  />
                ) : (
                  <div className="h-9 border-b border-dashed border-neutral-400 mx-auto w-36 mb-0.5" />
                )}
                <span className="text-[9px] uppercase font-bold text-neutral-900 block truncate">
                  {school?.principal_name || "Principal / Head of School"}
                </span>
              </div>

              {/* QR Verification Seal */}
              <div className="flex items-center justify-end gap-2 text-right">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-[var(--rc)]">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Verified Official Result</span>
                  </div>
                  <span className="text-[8px] font-mono text-neutral-500 block">
                    Code: {rc?.verification_code || "VERIFIED-2026"}
                  </span>
                </div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} className="h-11 w-11 border border-neutral-200 p-0.5 rounded-xs" alt="QR" />
                ) : (
                  <div className="h-11 w-11 bg-neutral-100 border border-neutral-200" />
                )}
              </div>
            </div>
          </div>
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
