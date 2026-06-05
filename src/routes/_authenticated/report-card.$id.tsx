import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/report-card/$id")({
  head: () => ({ meta: [{ title: "Report Card — EduERP" }] }),
  component: ReportCardPage,
});

type Assessment = {
  id: string;
  ca1: number; ca2: number; exam: number; total: number;
  grade: string | null; remark: string | null;
  subjects: { name: string; code: string | null } | null;
};

function ReportCardPage() {
  const { id } = Route.useParams();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const { data: rc, isLoading } = useQuery({
    queryKey: ["report-card", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_cards")
        .select(`
          *,
          schools:school_id (name, motto, address, email, phone, logo_url, stamp_url, website, branch_name, principal_name, principal_signature_url, current_session, current_term),
          students:student_id (first_name, middle_name, last_name, admission_no, gender, dob, photo_url, house, next_resumption_date),
          classes:class_id (name, arm, level, section)
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: assessments } = useQuery<Assessment[]>({
    queryKey: ["report-card-assess", id, rc?.student_id, rc?.session, rc?.term],
    enabled: !!rc?.student_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("assessments")
        .select("id, ca1, ca2, exam, total, grade, remark, subjects:subject_id(name, code)")
        .eq("student_id", rc!.student_id)
        .eq("session", rc!.session)
        .eq("term", rc!.term)
        .order("created_at");
      return (data ?? []) as unknown as Assessment[];
    },
  });

  useEffect(() => {
    if (!rc?.verification_code) return;
    const url = `${window.location.origin}/verify/${rc.verification_code}`;
    QRCode.toDataURL(url, { width: 160, margin: 1 }).then(setQrDataUrl);
  }, [rc?.verification_code]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading report card…</div>;
  if (!rc) return <div className="p-8 text-destructive">Report card not found.</div>;

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

  return (
    <div className="bg-muted/30 min-h-screen">
      {/* Toolbar (hidden when printing) */}
      <div className="print:hidden sticky top-0 z-10 border-b bg-card px-4 py-3 flex items-center justify-between">
        <Link to="/results" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to results
        </Link>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
      </div>

      {/* A4 sheet */}
      <div className="report-sheet mx-auto my-6 bg-white text-black shadow-lg print:shadow-none print:my-0">
        <div className="border-[6px] border-double border-[#0a6d3b] m-2 p-5">
          {/* Header */}
          <div className="flex items-start gap-4 border-b-2 border-[#0a6d3b] pb-3">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="logo" className="h-20 w-20 object-contain" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-[#0a6d3b]/10 grid place-items-center text-xs text-[#0a6d3b]">LOGO</div>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-extrabold uppercase text-[#0a6d3b] tracking-wide">{school?.name || "School Name"}</h1>
              {school?.motto && <p className="italic text-xs">— {school.motto} —</p>}
              <p className="text-xs mt-1">{school?.address}</p>
              <p className="text-[11px]">
                {[school?.phone, school?.email, school?.website].filter(Boolean).join("  •  ")}
              </p>
              {school?.branch_name && <p className="text-[11px] font-semibold">Branch: {school.branch_name}</p>}
              <p className="mt-2 inline-block bg-[#0a6d3b] text-white text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded">
                Student Report Card — {rc.session} • {String(rc.term).toUpperCase()} TERM
              </p>
            </div>
            {student?.photo_url ? (
              <img src={student.photo_url} alt="passport" className="h-24 w-20 object-cover border-2 border-[#0a6d3b]" />
            ) : (
              <div className="h-24 w-20 border-2 border-dashed border-[#0a6d3b]/50 grid place-items-center text-[10px] text-muted-foreground">Passport</div>
            )}
          </div>

          {/* Student info */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[12px] mt-3">
            <div><strong>Name:</strong> {fullName.toUpperCase()}</div>
            <div><strong>Adm. No.:</strong> {student?.admission_no}</div>
            <div><strong>Class:</strong> {klass?.name} {klass?.arm}</div>
            <div><strong>Gender:</strong> {student?.gender}</div>
            <div><strong>D.O.B:</strong> {student?.dob}</div>
            <div><strong>House:</strong> {student?.house || "—"}</div>
            <div><strong>Position:</strong> {rc.position} of {rc.class_size}</div>
            <div><strong>Average:</strong> {rc.average}%</div>
            <div><strong>GPA:</strong> {rc.gpa}</div>
          </div>

          {/* Scores table */}
          <table className="w-full mt-3 border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#0a6d3b] text-white">
                <th className="border border-[#0a6d3b] px-2 py-1 text-left">Subject</th>
                <th className="border border-[#0a6d3b] px-2 py-1">CA1 (20)</th>
                <th className="border border-[#0a6d3b] px-2 py-1">CA2 (20)</th>
                <th className="border border-[#0a6d3b] px-2 py-1">Exam (60)</th>
                <th className="border border-[#0a6d3b] px-2 py-1">Total (100)</th>
                <th className="border border-[#0a6d3b] px-2 py-1">Grade</th>
                <th className="border border-[#0a6d3b] px-2 py-1 text-left">Remark</th>
              </tr>
            </thead>
            <tbody>
              {(assessments ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="border px-2 py-1">{a.subjects?.name}</td>
                  <td className="border px-2 py-1 text-center">{a.ca1}</td>
                  <td className="border px-2 py-1 text-center">{a.ca2}</td>
                  <td className="border px-2 py-1 text-center">{a.exam}</td>
                  <td className="border px-2 py-1 text-center font-semibold">{a.total}</td>
                  <td className="border px-2 py-1 text-center font-bold">{a.grade}</td>
                  <td className="border px-2 py-1">{a.remark}</td>
                </tr>
              ))}
              {!assessments?.length && (
                <tr><td colSpan={7} className="border px-2 py-3 text-center text-muted-foreground">No subject assessments captured.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#0a6d3b]/10 font-semibold">
                <td className="border px-2 py-1">Total / Average</td>
                <td className="border px-2 py-1 text-center" colSpan={3}>Subjects: {rc.subjects_count}</td>
                <td className="border px-2 py-1 text-center">{rc.total_score}</td>
                <td className="border px-2 py-1 text-center">{rc.average}%</td>
                <td className="border px-2 py-1">Class avg position {rc.position}</td>
              </tr>
            </tfoot>
          </table>

          {/* Grading key + Psychomotor + Affective */}
          <div className="grid grid-cols-3 gap-3 mt-3 text-[11px]">
            <div>
              <h3 className="font-bold text-[#0a6d3b] border-b border-[#0a6d3b] mb-1">Grading Key</h3>
              <ul className="space-y-0.5">
                <li>A — 70–100 — Excellent</li>
                <li>B — 60–69 — Very Good</li>
                <li>C — 50–59 — Good</li>
                <li>D — 45–49 — Fair</li>
                <li>F — 0–44 — Fail</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-[#0a6d3b] border-b border-[#0a6d3b] mb-1">Psychomotor (1–5)</h3>
              <table className="w-full">
                <tbody>
                  {Object.entries(psyMerged).map(([k, v]) => (
                    <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="text-right font-semibold">{v || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-bold text-[#0a6d3b] border-b border-[#0a6d3b] mb-1">Affective (1–5)</h3>
              <table className="w-full">
                <tbody>
                  {Object.entries(affMerged).map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td className="text-right font-semibold">{v || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance */}
          <div className="grid grid-cols-4 gap-3 mt-3 text-[11px]">
            <div className="border border-[#0a6d3b] p-2"><strong>Days Open:</strong> {rc.days_total ?? "—"}</div>
            <div className="border border-[#0a6d3b] p-2"><strong>Present:</strong> {rc.days_present ?? "—"}</div>
            <div className="border border-[#0a6d3b] p-2"><strong>Absent:</strong> {rc.days_absent ?? "—"}</div>
            <div className="border border-[#0a6d3b] p-2"><strong>Next Resumption:</strong> {rc.next_resumption_date ?? student?.next_resumption_date ?? "—"}</div>
          </div>

          {/* Remarks */}
          <div className="mt-3 space-y-2 text-[12px]">
            <div className="border border-[#0a6d3b] p-2">
              <strong className="text-[#0a6d3b]">Class Teacher's Remark:</strong> {rc.teacher_remark || "—"}
            </div>
            <div className="border border-[#0a6d3b] p-2">
              <strong className="text-[#0a6d3b]">Principal's Remark:</strong> {rc.principal_remark || "—"}
            </div>
          </div>

          {/* Signatures + QR */}
          <div className="grid grid-cols-3 gap-4 mt-5 items-end text-[11px]">
            <div className="text-center">
              <div className="h-10 border-b border-dotted border-black/60 mb-1" />
              <div>Class Teacher's Signature</div>
            </div>
            <div className="text-center">
              {school?.principal_signature_url ? (
                <img src={school.principal_signature_url} className="h-10 mx-auto object-contain" alt="sign" />
              ) : (
                <div className="h-10 border-b border-dotted border-black/60 mb-1" />
              )}
              <div>{school?.principal_name || "Principal"}</div>
            </div>
            <div className="text-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} className="h-20 w-20 mx-auto" alt="QR verify" />
              ) : <div className="h-20 w-20 mx-auto bg-muted" />}
              <div className="flex items-center justify-center gap-1 text-[10px] mt-1">
                <ShieldCheck className="h-3 w-3 text-[#0a6d3b]" />
                Verify: {rc.verification_code}
              </div>
            </div>
          </div>

          {school?.stamp_url && (
            <img src={school.stamp_url} alt="stamp" className="absolute right-10 bottom-20 h-24 w-24 opacity-30 pointer-events-none" />
          )}
        </div>
      </div>

      <style>{`
        .report-sheet { width: 210mm; min-height: 297mm; position: relative; }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          .report-sheet { width: 100%; min-height: 100vh; box-shadow: none; margin: 0; }
        }
      `}</style>
    </div>
  );
}
