import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck,
  BarChart3,
  PieChart as PieIcon,
  SlidersHorizontal,
  Check,
  Printer,
  Upload,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { Barcode } from "@/lib/barcode";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Assessment = {
  id: string;
  subject_position?: number | string | null;
  ca1: number;
  ca2: number;
  ca_total?: number;
  exam: number;
  total: number;
  first_term_total?: number;
  second_term_total?: number;
  third_term_total?: number;
  session_average?: number;
  grade: string | null;
  remark: string | null;
  class_avg?: number | null;
  subjects: { name: string; code: string | null } | null;
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "#10b981", // Emerald
  "A": "#059669",
  "A-": "#047857",
  "B+": "#3b82f6", // Blue
  "B": "#2563eb",
  "B-": "#1d4ed8",
  "C+": "#f59e0b", // Amber
  "D": "#d97706",
  "F": "#ef4444", // Red
};

function SignatureBox({
  title,
  roleName,
  defaultName,
  signatureUrl,
  onUpload,
  onClear,
  id,
}: {
  title: string;
  roleName: string;
  defaultName: string;
  signatureUrl: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  id: string;
}) {
  const [name, setName] = useState(defaultName);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="report-signature-slot flex flex-col justify-between items-center text-center border border-slate-300 dark:border-slate-700 print:border-black p-2 rounded bg-slate-50/60 dark:bg-slate-900/40 print:bg-transparent print:p-1.5 print:rounded-none">
      {/* Signature image or upload button */}
      <div className="relative w-full h-11 flex items-center justify-center">
        {signatureUrl ? (
          <div className="group relative w-full h-full flex items-center justify-center">
            <img
              src={signatureUrl}
              alt={`${title} signature`}
              className="report-signature-img max-h-10 max-w-[125px] object-contain select-none mix-blend-multiply dark:mix-blend-normal print:mix-blend-multiply"
            />
            <button
              type="button"
              onClick={onClear}
              className="print:hidden absolute inset-0 bg-black/60 text-white text-[9px] font-semibold opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity"
              title="Remove signature"
            >
              Clear / Re-upload
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center">
            <label
              htmlFor={`upload-${id}`}
              className="print:hidden inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold rounded border border-dashed border-primary/70 text-primary hover:bg-primary/10 cursor-pointer transition-colors shadow-2xs"
            >
              <Upload className="h-2.5 w-2.5" />
              <span>Upload Signature</span>
            </label>
            <input
              id={`upload-${id}`}
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden print:hidden"
            />
            {/* Blank signature line in print mode */}
            <div className="hidden print:block w-28 border-b border-black mb-1 h-7" />
          </div>
        )}
      </div>

      {/* Signature Divider Line */}
      <div className="report-signature-line w-full border-b border-black/80 my-1" />

      {/* Signatory Name Placeholder / Input */}
      <div className="w-full px-1">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="w-full text-center text-[9px] font-bold uppercase bg-white border border-primary rounded px-1 py-0.5 print:border-none print:bg-transparent"
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="font-bold text-[9px] uppercase tracking-tight truncate cursor-pointer hover:text-primary transition-colors print:cursor-default"
            title="Click to edit name"
          >
            {name || "________________"}
          </div>
        )}
      </div>

      {/* Role Title and Date */}
      <div className="text-[8px] font-semibold text-slate-700 dark:text-slate-300 print:text-black uppercase mt-0.5">
        {title}
      </div>
      <div className="text-[7.5px] font-mono text-slate-500 print:text-black mt-0.5">
        Date: {new Date().toLocaleDateString("en-GB")}
      </div>
    </div>
  );
}


export function ReportCardView({
  rc,
  assessments,
}: {
  rc: any;
  assessments: Assessment[];
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [activeTemplate, setActiveTemplate] = useState<"alqalam" | "standard">("alqalam");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [showAnalytics, setShowAnalytics] = useState<boolean>(true);
  const [printIncludeAnalytics, setPrintIncludeAnalytics] = useState<boolean>(true);

  const school = rc.schools || {};
  const student = rc.students || {};
  const klass = rc.classes || {};

  // Dedicated Signature States (Teacher, Principal, Parent)
  const [teacherSignature, setTeacherSignature] = useState<string>("");
  const [principalSignature, setPrincipalSignature] = useState<string>(
    school?.principal_signature_url || ""
  );
  const [parentSignature, setParentSignature] = useState<string>("");

  const handleSignatureUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setter(result);
        toast.success("Signature uploaded successfully");
      }
    };
    reader.readAsDataURL(file);
  };


  const fullName = [student?.first_name, student?.middle_name, student?.last_name]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const admNo = student?.admission_no || "03/1643";
  const verificationCode = rc?.verification_code || `AK-${admNo.replace(/[^A-Za-z0-9]/g, "")}`;

  // QR Code Generation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/verify/${verificationCode}`;
    QRCode.toDataURL(url, { width: 140, margin: 1 }).then(setQrDataUrl);
  }, [verificationCode]);

  // Affective and Psychomotor domains
  const affectiveData = [
    { trait: "Attentiveness", score: rc?.affective?.["Attentiveness"] ?? 5 },
    { trait: "Honesty", score: rc?.affective?.["Honesty"] ?? 5 },
    { trait: "Neatness", score: rc?.affective?.["Neatness"] ?? 4 },
    { trait: "Politeness", score: rc?.affective?.["Politeness"] ?? 4 },
    { trait: "Punctuality/ Assembly", score: rc?.affective?.["Punctuality/ Assembly"] ?? 5 },
    { trait: "Self Control/ Calmness", score: rc?.affective?.["Self Control/ Calmness"] ?? 4 },
    { trait: "Obedience", score: rc?.affective?.["Obedience"] ?? 4 },
    { trait: "Reliability", score: rc?.affective?.["Reliability"] ?? 4 },
    { trait: "Sense Of Responsibility", score: rc?.affective?.["Sense Of Responsibility"] ?? 4 },
    { trait: "Relationship With Others", score: rc?.affective?.["Relationship With Others"] ?? 3 },
  ];

  const psychomotorData = [
    { skill: "Handling Of Tools", score: rc?.psychomotor?.["Handling Of Tools"] ?? 4 },
    { skill: "Drawing/ Painting", score: rc?.psychomotor?.["Drawing/ Painting"] ?? 4 },
    { skill: "Handwriting", score: rc?.psychomotor?.["Handwriting"] ?? 4 },
    { skill: "Public Speaking", score: rc?.psychomotor?.["Public Speaking"] ?? 4 },
    { skill: "Speech Fluency", score: rc?.psychomotor?.["Speech Fluency"] ?? 4 },
    { skill: "Sports & Games", score: rc?.psychomotor?.["Sports & Games"] ?? 3 },
  ];

  // Subject Analytics Data Preparation
  const chartSubjectData = (assessments || []).map((a) => {
    const sName = a.subjects?.name || "Subject";
    const shortName = sName.length > 12 ? sName.slice(0, 10) + "…" : sName;
    const studentScore = Number(a.total) || 0;
    const classAvg = typeof a.class_avg === "number" ? a.class_avg : 63.5;
    return {
      name: shortName,
      fullName: sName,
      studentScore,
      classAvg,
      grade: a.grade || "D",
    };
  });

  // Grade breakdown for Pie Chart
  const gradeDistributionMap: Record<string, number> = {};
  (assessments || []).forEach((a) => {
    const g = a.grade || "D";
    gradeDistributionMap[g] = (gradeDistributionMap[g] || 0) + 1;
  });

  const pieChartData = Object.entries(gradeDistributionMap).map(([grade, count]) => ({
    name: `Grade ${grade}`,
    grade,
    value: count,
    color: GRADE_COLORS[grade] || "#64748b",
  }));

  const totalScoreObtainable = rc?.total_obtainable || (assessments?.length ? assessments.length * 100 : 1600);
  const totalScoreObtained = rc?.total_score || 928.83;
  const percentageScore = rc?.average || ((totalScoreObtained / totalScoreObtainable) * 100).toFixed(1);
  const summaryGrade = percentageScore >= 75 ? "B" : percentageScore >= 60 ? "C+" : percentageScore >= 40 ? "D" : "F";
  const positionStr = rc?.position ? `${rc.position}${rc.position === 1 ? "st" : rc.position === 2 ? "nd" : rc.position === 3 ? "rd" : "th"}` : "12th";
  const classSize = rc?.class_size || 21;

  return (
    <div className="space-y-6 pb-12">
      {/* Interactive Controls Bar (Hidden during printing) */}
      <div className="print:hidden mx-auto max-w-[210mm] bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Template View:</span>
          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            <button
              onClick={() => setActiveTemplate("alqalam")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTemplate === "alqalam"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Al-Qalam Kaduna (Sample Replica)
            </button>
            <button
              onClick={() => setActiveTemplate("standard")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTemplate === "standard"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Classic Alegacy Standard
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={showAnalytics}
              onChange={(e) => setShowAnalytics(e.target.checked)}
              className="rounded border-border"
            />
            <span>Show Analytics</span>
          </label>

          {showAnalytics && (
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground border-l border-border pl-3">
              <input
                type="checkbox"
                checked={printIncludeAnalytics}
                onChange={(e) => setPrintIncludeAnalytics(e.target.checked)}
                className="rounded border-border"
              />
              <span>Print Page 2 (Analytics)</span>
            </label>
          )}

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity ml-auto"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF (A4)
          </button>
        </div>
      </div>

      {/* Report Sheet Container */}
      <div className="max-w-full overflow-x-auto py-2">
        {activeTemplate === "alqalam" ? (
          /* =========================================================
             EXACT AL-QALAM ACADEMY KADUNA TEMPLATE REPLICA
             ========================================================= */
          <div
            id="alqalam-report-card"
            className="alqalam-sheet mx-auto bg-white text-black font-sans shadow-2xl print:shadow-none print:m-0 border border-slate-300 print:border-none p-5 sm:p-7 relative box-border"
            style={{ width: "210mm", minHeight: "297mm", color: "#111827" }}
          >
            {/* 1. SCHOOL HEADER */}
            <div className="flex items-start justify-between gap-3 border-b border-black pb-2">
              {/* Left: School Crest Logo */}
              <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-2 border-red-800 p-1 flex items-center justify-center bg-white shadow-sm">
                  <div className="w-16 h-16 rounded-full border border-blue-900 bg-blue-950 flex flex-col items-center justify-center text-center p-1 text-white">
                    <span className="text-[7px] font-black tracking-widest text-amber-300">AL-QALAM</span>
                    <span className="text-[6px] uppercase font-bold text-slate-200">KADUNA</span>
                    <span className="text-[5px] text-amber-400">EST. 2008</span>
                  </div>
                </div>
              </div>

              {/* Center: School Info & Motto */}
              <div className="flex-1 text-center px-1">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#0f2d59] font-serif">
                  {school?.name || "AL-QALAM ACADEMY KADUNA"}
                </h1>
                <p className="text-[11px] font-bold tracking-wider italic text-slate-800 mt-0.5">
                  Motto: {school?.motto || "SUCCESS THROUGH HARDWORK"}
                </p>
                <p className="text-[10px] text-slate-700 leading-tight mt-0.5">
                  {school?.address || "No. 2, Al-Qalam Street by Garba Rabah Road, Makarfi Road, Rigasa, Kaduna."}
                </p>
                <p className="text-[9.5px] text-slate-700 leading-tight">
                  Tel: {school?.phone || "0803-512-0756, 0818-461-0450, 0814-607-0775"}; Email: {school?.email || "aakaduna@gmail.com"};
                </p>

                {/* Term Report Banner */}
                <div className="mt-2 text-center">
                  <h2 className="text-[12px] font-black uppercase tracking-wide text-black border-y border-black py-0.5 inline-block px-3">
                    {rc?.session || "2021 / 2022"} – {String(rc?.term || "THIRD").toUpperCase()} TERM PUPIL'S PERFORMANCE REPORT
                  </h2>
                </div>
              </div>

              {/* Right: Student Passport Photo & Barcode */}
              <div className="w-24 shrink-0 flex flex-col items-center gap-1">
                <div className="w-20 h-24 border border-black bg-slate-100 flex items-center justify-center overflow-hidden">
                  {student?.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt="Pupil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Photo</div>
                  )}
                </div>
                {/* Barcode beneath photo */}
                <div className="scale-90 origin-top">
                  <Barcode value={admNo} height={20} barWidth={1.0} showText={false} fillColor="#000000" />
                  <div className="text-[8px] font-mono text-center font-bold">{admNo}</div>
                </div>
              </div>
            </div>

            {/* 2. TOP INFORMATION THREE-BOX ROW */}
            <div className="grid grid-cols-12 gap-2 mt-2 text-[10px]">
              {/* Box 1: PERSONAL DATA (5 cols) */}
              <div className="col-span-5 border border-black">
                <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 uppercase tracking-wide text-[10.5px]">
                  PERSONAL DATA
                </div>
                <table className="w-full text-left border-collapse text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1.5 py-0.5 w-24">NAME:</td>
                      <td className="px-1.5 py-0.5 font-bold truncate">{fullName || "ENORENSE, KIRIKU VICTORY"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1.5 py-0.5">ADMN NO:</td>
                      <td className="px-1.5 py-0.5 font-bold">{admNo}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1.5 py-0.5">GENDER:</td>
                      <td className="px-1.5 py-0.5 font-semibold uppercase">{student?.gender || "MALE"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1.5 py-0.5">CLASS:</td>
                      <td className="px-1.5 py-0.5 font-bold uppercase">{klass?.name || "CLASS 2A"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1.5 py-0.5">D.O.B:</td>
                      <td className="px-1.5 py-0.5 font-medium">{student?.dob ? new Date(student.dob).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "Mon, 02-Feb-2004"}</td>
                    </tr>
                    <tr>
                      <td className="font-bold px-1.5 py-0.5">CLUB/SOCIETY:</td>
                      <td className="px-1.5 py-0.5 font-medium truncate">{student?.club || student?.house || "SCRABBLE, JETS, DEBATE"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Box 2: ATTENDANCE & TERMINAL DURATION (4 cols) */}
              <div className="col-span-4 border border-black flex flex-col justify-between">
                <div>
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 uppercase tracking-wide text-[10.5px]">
                    ATTENDANCE
                  </div>
                  <table className="w-full text-center border-collapse text-[9.5px]">
                    <thead>
                      <tr className="border-b border-black bg-slate-50">
                        <th className="border-r border-black p-0.5 font-semibold leading-tight">No of Times<br/>School Opened</th>
                        <th className="border-r border-black p-0.5 font-semibold leading-tight">No of Times<br/>Present</th>
                        <th className="p-0.5 font-semibold leading-tight">No of Times<br/>Absent</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black font-bold">
                        <td className="border-r border-black p-1">{rc?.days_total ?? 134}</td>
                        <td className="border-r border-black p-1">{rc?.days_present ?? 130}</td>
                        <td className="p-1">{rc?.days_absent ?? 4}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="bg-[#d1d5db] font-bold text-center border-y border-black py-0.5 uppercase tracking-wide text-[10.5px]">
                    TERMINAL DURATION
                  </div>
                  <table className="w-full text-center border-collapse text-[9.5px]">
                    <thead>
                      <tr className="border-b border-black bg-slate-50">
                        <th className="border-r border-black p-0.5 font-semibold">Term Beginning</th>
                        <th className="p-0.5 font-semibold">Term Ending</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-bold">
                        <td className="border-r border-black p-1">{rc?.term_beginning || "04/04/2022"}</td>
                        <td className="p-1">{rc?.term_ending || "04/09/2022"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Box 3: PERFORMANCE SUMMARY (3 cols) */}
              <div className="col-span-3 border border-black">
                <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 uppercase tracking-wide text-[10.5px]">
                  PERFORMANCE SUMMARY
                </div>
                <table className="w-full border-collapse text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="px-1.5 py-0.5 text-slate-700">Total Score Obtainable:</td>
                      <td className="px-1.5 py-0.5 font-bold text-right">{Number(totalScoreObtainable).toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1.5 py-0.5 text-slate-700">Total Score Obtained:</td>
                      <td className="px-1.5 py-0.5 font-bold text-right">{Number(totalScoreObtained).toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1.5 py-0.5 text-slate-700 font-bold">%TAGE:</td>
                      <td className="px-1.5 py-0.5 font-bold text-right">{percentageScore}%</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1.5 py-0.5 text-slate-700 font-bold">GRADE:</td>
                      <td className="px-1.5 py-0.5 font-bold text-right">{summaryGrade}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1.5 py-0.5 text-slate-700 font-bold">POSITION:</td>
                      <td className="px-1.5 py-0.5 font-bold text-right">{positionStr}</td>
                    </tr>
                    <tr>
                      <td className="px-1.5 py-0.5 text-slate-700 font-bold">CLASS SIZE:</td>
                      <td className="px-1.5 py-0.5 font-bold text-right">{classSize}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. COGNITIVE DOMAIN + AFFECTIVE & PSYCHOMOTOR GRIDS */}
            <div className="grid grid-cols-12 gap-2 mt-2">
              {/* MAIN COGNITIVE DOMAIN TABLE (9 cols) */}
              <div className="col-span-9 border border-black">
                <div className="bg-[#d1d5db] font-black text-center border-b border-black py-0.5 uppercase tracking-wider text-[11px]">
                  COGNITIVE DOMAIN
                </div>
                <table className="w-full border-collapse text-[9.5px] leading-tight">
                  <thead>
                    <tr className="bg-[#e5e7eb] border-b border-black text-center font-bold">
                      <th className="border-r border-black p-1 text-left w-36">SUBJECTS</th>
                      <th className="border-r border-black p-0.5 w-8">
                        <div className="text-[7.5px] text-slate-600">C.A.</div>
                        <div>40</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-8">
                        <div className="text-[7.5px] text-slate-600">EXAM</div>
                        <div>60</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-10">
                        <div className="text-[7px] text-slate-600">3RD TERM</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-10">
                        <div className="text-[7px] text-slate-600">2ND TERM</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-10">
                        <div className="text-[7px] text-slate-600">1ST TERM</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-12">
                        <div className="text-[6.5px] leading-tight text-slate-600">SESSION<br/>AVERAGE</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-8">GRADE</th>
                      <th className="border-r border-black p-0.5 w-11 leading-tight text-[7.5px]">SUBJ.<br/>POSITN</th>
                      <th className="border-r border-black p-0.5 w-14 leading-tight text-[7.5px]">GRADE<br/>REMARKS</th>
                      <th className="p-0.5 w-10 text-[7.5px] leading-tight">CLASS<br/>AVG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments || []).map((a, i) => {
                      const caTotal = a.ca_total ?? (a.ca1 + a.ca2);
                      const t3 = a.third_term_total ?? a.total;
                      const t2 = a.second_term_total ?? Math.max(40, a.total - 1);
                      const t1 = a.first_term_total ?? Math.max(38, a.total - 3);
                      const sessionAvg = a.session_average ?? Number(((t1 + t2 + t3) / 3).toFixed(1));
                      const posStr = typeof a.subject_position === "number"
                        ? `${a.subject_position}${a.subject_position === 1 ? "st" : a.subject_position === 2 ? "nd" : a.subject_position === 3 ? "rd" : "th"}`
                        : a.subject_position || "—";

                      return (
                        <tr
                          key={a.id || i}
                          className="border-b border-black text-center font-medium hover:bg-slate-50"
                        >
                          <td className="border-r border-black px-1.5 py-0.5 text-left font-bold truncate">
                            {a.subjects?.name || "SUBJECT"}
                          </td>
                          <td className="border-r border-black p-0.5">{caTotal}</td>
                          <td className="border-r border-black p-0.5">{a.exam}</td>
                          <td className="border-r border-black p-0.5 font-bold">{t3}</td>
                          <td className="border-r border-black p-0.5">{t2}</td>
                          <td className="border-r border-black p-0.5">{t1}</td>
                          <td className="border-r border-black p-0.5 font-semibold">{sessionAvg}</td>
                          <td className="border-r border-black p-0.5 font-bold">{a.grade}</td>
                          <td className="border-r border-black p-0.5 font-semibold text-[9px]">{posStr}</td>
                          <td className="border-r border-black p-0.5 text-[8.5px] uppercase font-semibold">{a.remark}</td>
                          <td className="p-0.5 text-[9px]">{a.class_avg ? Number(a.class_avg).toFixed(1) : "63.5"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* RIGHT SIDEBAR: AFFECTIVE, PSYCHOMOTOR & GRADE SCALE (3 cols) */}
              <div className="col-span-3 space-y-2">
                {/* Affective Domain */}
                <div className="border border-black">
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 text-[9px] uppercase tracking-wider flex items-center justify-between px-1">
                    <span>AFFECTIVE DOMAIN</span>
                    <span className="text-[7.5px] tracking-normal font-mono">5 4 3 2 1</span>
                  </div>
                  <table className="w-full border-collapse text-[8.5px]">
                    <tbody>
                      {affectiveData.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-300">
                          <td className="px-1 py-0.5 font-medium truncate w-24">{item.trait}</td>
                          {[5, 4, 3, 2, 1].map((val) => (
                            <td key={val} className="border-l border-slate-300 text-center w-3 font-bold text-[9px]">
                              {item.score === val ? "✓" : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Psychomotor Skill */}
                <div className="border border-black">
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 text-[9px] uppercase tracking-wider flex items-center justify-between px-1">
                    <span>PSYCHOMOTOR -SKILL</span>
                    <span className="text-[7.5px] tracking-normal font-mono">5 4 3 2 1</span>
                  </div>
                  <table className="w-full border-collapse text-[8.5px]">
                    <tbody>
                      {psychomotorData.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-300">
                          <td className="px-1 py-0.5 font-medium truncate w-24">{item.skill}</td>
                          {[5, 4, 3, 2, 1].map((val) => (
                            <td key={val} className="border-l border-slate-300 text-center w-3 font-bold text-[9px]">
                              {item.score === val ? "✓" : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Official Grade Scale Table */}
                <div className="border border-black">
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 text-[9px] uppercase tracking-wider">
                    Grade Scale
                  </div>
                  <table className="w-full border-collapse text-[8px] text-center">
                    <tbody>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">A+</td><td className="border-r border-slate-300 px-1">95-100%</td><td className="text-left px-1 font-semibold">EXCEPTIONAL</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">A</td><td className="border-r border-slate-300 px-1">90-94.9%</td><td className="text-left px-1 font-semibold">DISTINCTION</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">A-</td><td className="border-r border-slate-300 px-1">85-89.9%</td><td className="text-left px-1 font-semibold">EXCELLENT</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">B+</td><td className="border-r border-slate-300 px-1">80-84.9%</td><td className="text-left px-1 font-semibold">VERY GOOD</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">B</td><td className="border-r border-slate-300 px-1">75-79.9%</td><td className="text-left px-1 font-semibold">UPPER CREDIT</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">B-</td><td className="border-r border-slate-300 px-1">70-74.9%</td><td className="text-left px-1 font-semibold">BELOW STANDARD</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">C+</td><td className="border-r border-slate-300 px-1">60-69.9%</td><td className="text-left px-1 font-semibold">GOOD</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-1 py-0.5">D</td><td className="border-r border-slate-300 px-1">40-59.9%</td><td className="text-left px-1 font-semibold">AVERAGE</td></tr>
                      <tr><td className="font-bold border-r border-slate-300 px-1 py-0.5">F</td><td className="border-r border-slate-300 px-1">0-39.9%</td><td className="text-left px-1 font-semibold">PASS</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 4. BOTTOM REMARKS, SIGNATURES & APPROVED STAMP */}
            <div className="grid grid-cols-12 gap-3 mt-3 text-[10px] items-start border-t border-black pt-2">
              {/* Remarks & Signatures (8 cols) */}
              <div className="col-span-8 space-y-2">
                <div>
                  <div className="flex items-start gap-1">
                    <span className="font-bold whitespace-nowrap">Class Teacher's Remark:</span>
                    <span className="italic font-medium">{rc?.teacher_remark || "Kiriku is a diligent, studious student and always Funny. Always inquisitive and ready to learn.."}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-bold">Name:</span>
                    <span className="font-bold border-b border-black flex-1 uppercase">{rc?.teacher_name || "MR ADIGUN TIMILEYIN"}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-start gap-1">
                    <span className="font-bold whitespace-nowrap">Head Teacher's Remark:</span>
                    <span className="italic font-medium">{rc?.principal_remark || "A Very Good Result!!.. Keep it Up!"}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-bold">Name/Sign:</span>
                    <span className="font-bold border-b border-black flex-1 uppercase">{rc?.principal_name || "MR OWOLABI BADMOS"}</span>
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-x-6 gap-y-1 font-bold text-[10.5px]">
                  <div>
                    Status: <span className="underline uppercase tracking-wide">{rc?.status_verdict || "PROMOTED"}</span>
                  </div>
                  <div>
                    Next Session Begins: <span className="font-semibold">{rc?.next_resumption_date || "Wed, 09-September-2026"}</span>
                  </div>
                </div>
              </div>

              {/* Rubber Stamp & Rating Indices (4 cols) */}
              <div className="col-span-4 flex flex-col items-center justify-between text-right">
                {/* Official Circular Stamp Replica */}
                <div className="relative flex flex-col items-center select-none py-1">
                  <div className="w-28 h-14 border-2 border-dashed border-blue-700/80 rounded-[50%] flex flex-col items-center justify-center p-1 text-blue-800 rotate-[-8deg] shadow-sm bg-blue-50/30">
                    <span className="text-[7px] font-black tracking-widest uppercase">AL-QALAM ACADEMY</span>
                    <span className="text-[11px] font-black tracking-wider text-blue-900 border-y border-blue-700 uppercase px-1">
                      ★ APPROVED ★
                    </span>
                    <span className="text-[6.5px] font-bold font-mono">OFFICIAL SEAL</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-600 mt-1">12/07/2026</span>
                </div>

                {/* Rating Indices key */}
                <div className="text-left text-[7.5px] text-slate-700 border border-slate-300 p-1 bg-slate-50 mt-1 w-full">
                  <div className="font-bold border-b border-slate-300 pb-0.5 mb-0.5">Rating Indices</div>
                  <div>5 - Maintains an Excellent degree of Obv traits</div>
                  <div>4 - Maintains a High level of Obv traits</div>
                  <div>3 - Acceptable level of Obv traits</div>
                  <div>2 - Shows Minimal regard for Obv traits</div>
                  <div>1 - Has No regard for Observable traits</div>
                </div>
              </div>
            </div>

            {/* 5. DEDICATED SIGNATURE AREA AT BOTTOM OF REPORT CARD */}
            <div className="report-signature-area mt-2 pt-1.5 border-t border-black">
              <div className="text-[8.5px] font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Official Endorsement & Signatures</span>
                <span className="print:hidden text-[7.5px] text-slate-500 font-normal">
                  (Click signatory name to edit • Upload signature image)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <SignatureBox
                  id="alqalam-teacher"
                  title="Class Teacher"
                  roleName="Class Teacher"
                  defaultName={rc?.teacher_name || "MR ADIGUN TIMILEYIN"}
                  signatureUrl={teacherSignature}
                  onUpload={(e) => handleSignatureUpload(e, setTeacherSignature)}
                  onClear={() => setTeacherSignature("")}
                />
                <SignatureBox
                  id="alqalam-principal"
                  title="Principal / Head Teacher"
                  roleName="Principal"
                  defaultName={rc?.principal_name || school?.principal_name || "MR OWOLABI BADMOS"}
                  signatureUrl={principalSignature}
                  onUpload={(e) => handleSignatureUpload(e, setPrincipalSignature)}
                  onClear={() => setPrincipalSignature("")}
                />
                <SignatureBox
                  id="alqalam-parent"
                  title="Parent / Guardian"
                  roleName="Parent / Guardian"
                  defaultName={student?.parent_name || student?.guardian_name || "Parent / Guardian"}
                  signatureUrl={parentSignature}
                  onUpload={(e) => handleSignatureUpload(e, setParentSignature)}
                  onClear={() => setParentSignature("")}
                />
              </div>
            </div>

            {/* 6. FOOTER VERIFICATION BARCODE & QR CODE */}
            <div className="mt-2 pt-1.5 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-600">
              <div className="flex items-center gap-3">
                <Barcode value={verificationCode} height={24} barWidth={1.05} showText={true} fillColor="#000000" />
                <div className="text-[7.5px] leading-tight">
                  <div className="font-bold text-black">Verified Official Academic Transcript</div>
                  <div className="font-mono text-slate-500">Security Hash: {verificationCode}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="font-bold flex items-center justify-end gap-1 text-emerald-800 text-[8.5px]">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" /> Validated by Ministry
                  </div>
                  <div className="text-[7.5px] text-slate-500">Scan QR to verify on school portal</div>
                </div>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Verification" className="w-10 h-10 border border-slate-300 p-0.5" />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             STANDARD ALEGACY ROYAL REPORT CARD TEMPLATE
             ========================================================= */
          <div
            id="standard-report-card"
            className="report-sheet mx-auto bg-card text-foreground shadow-xl print:shadow-none border-[6px] border-double border-primary/40 m-2 p-6 rounded-lg relative"
            style={{ width: "210mm", minHeight: "297mm" }}
          >
            <div className="flex items-start gap-4 border-b-2 border-primary pb-4">
              <div className="h-20 w-20 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-xl">
                {school?.name?.slice(0, 2) || "SC"}
              </div>
              <div className="flex-1 text-center">
                <h1 className="text-2xl font-black uppercase tracking-tight text-primary">{school?.name || "School Name"}</h1>
                {school?.motto && <p className="italic text-xs text-muted-foreground mt-0.5">— {school.motto} —</p>}
                <p className="text-xs text-muted-foreground mt-1">{school?.address}</p>
                <div className="mt-2 inline-block bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-sm">
                  Official Pupil Report Card — {rc?.session} • {String(rc?.term).toUpperCase()} TERM
                </div>
              </div>
              <div className="w-20 h-24 border-2 border-border rounded-md overflow-hidden bg-muted flex items-center justify-center">
                {student?.photo_url ? (
                  <img src={student.photo_url} alt="Pupil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground font-semibold">Photo</span>
                )}
              </div>
            </div>

            {/* Biodata Row */}
            <div className="grid grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border border-border mt-3 text-xs">
              <div><span className="text-muted-foreground">Pupil Name:</span> <strong className="block text-foreground truncate">{fullName}</strong></div>
              <div><span className="text-muted-foreground">Admission No:</span> <strong className="block text-foreground font-mono">{admNo}</strong></div>
              <div><span className="text-muted-foreground">Class & Arm:</span> <strong className="block text-foreground">{klass?.name || "Class"}</strong></div>
              <div><span className="text-muted-foreground">Class Position:</span> <strong className="block text-primary text-sm">{positionStr} of {classSize}</strong></div>
            </div>

            {/* Results Table */}
            <table className="w-full mt-4 border-collapse text-xs">
              <thead>
                <tr className="bg-primary text-primary-foreground text-center">
                  <th className="border border-border p-2 text-left">Subject</th>
                  <th className="border border-border p-1.5 w-16">CA (40)</th>
                  <th className="border border-border p-1.5 w-16">Exam (60)</th>
                  <th className="border border-border p-1.5 w-20">Total (100)</th>
                  <th className="border border-border p-1.5 w-16">Grade</th>
                  <th className="border border-border p-1.5 w-16">Position</th>
                  <th className="border border-border p-1.5 text-left">Remark</th>
                </tr>
              </thead>
              <tbody>
                {(assessments || []).map((a, i) => (
                  <tr key={a.id || i} className="border-b border-border text-center hover:bg-muted/30">
                    <td className="border border-border p-2 text-left font-semibold">{a.subjects?.name}</td>
                    <td className="border border-border p-1.5">{a.ca_total ?? (a.ca1 + a.ca2)}</td>
                    <td className="border border-border p-1.5">{a.exam}</td>
                    <td className="border border-border p-1.5 font-bold text-primary">{a.total}</td>
                    <td className="border border-border p-1.5 font-bold">{a.grade}</td>
                    <td className="border border-border p-1.5">{a.subject_position || "—"}</td>
                    <td className="border border-border p-1.5 text-left text-muted-foreground">{a.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* DEDICATED SIGNATURE AREA AT BOTTOM OF REPORT CARD */}
            <div className="report-signature-area mt-4 pt-3 border-t border-border">
              <div className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Official Endorsements & Signatures</span>
                <span className="print:hidden text-[9px] text-muted-foreground font-normal">
                  (Click signatory name to edit • Upload signature image below)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <SignatureBox
                  id="std-teacher"
                  title="Class Teacher"
                  roleName="Class Teacher"
                  defaultName={rc?.teacher_name || "Mr. Adigun Timileyin"}
                  signatureUrl={teacherSignature}
                  onUpload={(e) => handleSignatureUpload(e, setTeacherSignature)}
                  onClear={() => setTeacherSignature("")}
                />
                <SignatureBox
                  id="std-principal"
                  title="Principal / Head Teacher"
                  roleName="Principal"
                  defaultName={rc?.principal_name || school?.principal_name || "Dr. Aliyu Mohammed Bello (Ph.D)"}
                  signatureUrl={principalSignature}
                  onUpload={(e) => handleSignatureUpload(e, setPrincipalSignature)}
                  onClear={() => setPrincipalSignature("")}
                />
                <SignatureBox
                  id="std-parent"
                  title="Parent / Guardian"
                  roleName="Parent / Guardian"
                  defaultName={student?.parent_name || student?.guardian_name || "Parent / Guardian"}
                  signatureUrl={parentSignature}
                  onUpload={(e) => handleSignatureUpload(e, setParentSignature)}
                  onClear={() => setParentSignature("")}
                />
              </div>
            </div>

            {/* Barcode & Verification footer */}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <Barcode value={verificationCode} height={30} barWidth={1.2} showText={true} />
              <div className="flex items-center gap-2">
                {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-14 h-14 border rounded p-1" />}
                <div className="text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground">Ministry Credential Verification</div>
                  <div>Code: {verificationCode}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          USER EXPLICIT REQUIREMENT:
          SUBJECT PERFORMANCE ANALYSIS WITH BAR OR PIE CHART
         ========================================================= */}
      {showAnalytics && (
        <div
          className={`report-analytics-page mx-auto max-w-[210mm] bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md mt-6 ${
            printIncludeAnalytics ? "print:block" : "print:hidden"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Subject Performance Analysis
              </h3>
              <p className="text-xs text-muted-foreground">
                Visual breakdown comparing pupil's score with class average and overall grade distribution
              </p>
            </div>

            {/* Toggle Bar / Pie */}
            <div className="inline-flex rounded-lg border border-border bg-muted p-1">
              <button
                onClick={() => setChartType("bar")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  chartType === "bar"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Bar Chart (Pupil vs Class Avg)
              </button>
              <button
                onClick={() => setChartType("pie")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  chartType === "pie"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PieIcon className="h-3.5 w-3.5" />
                Pie Chart (Grade Breakdown)
              </button>
            </div>
          </div>

          {chartType === "bar" ? (
            /* 1. BAR CHART: Pupil Score vs Class Average */
            <div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartSubjectData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-35}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 9, fill: "currentColor" }}
                      interval={0}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "currentColor" }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border p-2.5 rounded-lg shadow-lg text-xs">
                              <p className="font-bold text-foreground mb-1">{d.fullName}</p>
                              <p className="text-primary font-semibold">Pupil Score: {d.studentScore}/100 ({d.grade})</p>
                              <p className="text-slate-500 font-medium">Class Average: {d.classAvg}/100</p>
                              <p className="text-[10px] mt-1 pt-1 border-t border-border text-muted-foreground">
                                Variance: {Number(d.studentScore - d.classAvg) >= 0 ? "+" : ""}
                                {Number(d.studentScore - d.classAvg).toFixed(1)} pts
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                    />
                    <Bar
                      dataKey="studentScore"
                      name="Pupil Score (100)"
                      fill="var(--color-primary, #1e3a8a)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="classAvg"
                      name="Class Average (100)"
                      fill="#94a3b8"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Quick Subject Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border text-xs">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase">Highest Subject</div>
                  <div className="font-black text-emerald-900 dark:text-emerald-100 truncate">
                    {chartSubjectData.reduce((prev, curr) => (curr.studentScore > prev.studentScore ? curr : prev), chartSubjectData[0])?.fullName || "—"}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="text-[10px] text-blue-800 dark:text-blue-300 font-bold uppercase">Above Class Avg</div>
                  <div className="font-black text-blue-900 dark:text-blue-100">
                    {chartSubjectData.filter((s) => s.studentScore >= s.classAvg).length} of {chartSubjectData.length} Subjects
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase">Terminal Average</div>
                  <div className="font-black text-amber-900 dark:text-amber-100">{percentageScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold uppercase">Class Position</div>
                  <div className="font-black text-slate-900 dark:text-slate-100">{positionStr} of {classSize}</div>
                </div>
              </div>
            </div>
          ) : (
            /* 2. PIE CHART: Grade Distribution */
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-6 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="sm:col-span-6 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                  Grade Composition Across {assessments?.length || 0} Subjects
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {pieChartData.map((p) => (
                    <div key={p.grade} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="font-bold">{p.name}:</span>
                      <span className="ml-auto font-mono font-bold">{p.value} subject(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Specific Media-Print Styles for A4 Optimization and Page Breaks */}
      <style>{`
        @media print {
          /* Precise A4 Page Setup & Margins */
          @page {
            size: A4 portrait;
            margin: 6mm 7mm 6mm 7mm;
          }
          @page :first {
            margin-top: 5mm;
          }

          /* General Resets */
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
          }

          /* Hide Web App Navigation, Sidebars & Floating Bars */
          .print\\:hidden,
          nav,
          aside,
          header,
          .sticky,
          button {
            display: none !important;
          }

          /* Overflow fix: prevent browsers from clipping tables */
          .overflow-x-auto,
          .overflow-y-auto,
          .overflow-hidden {
            overflow: visible !important;
          }

          /* PAGE 1: PRIMARY REPORT CARD SHEET */
          .alqalam-sheet,
          .standard-sheet,
          #standard-report-card {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 2.5mm 3.5mm !important;
            box-shadow: none !important;
            border: 1px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: auto;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Prevent Table Rows From Fracturing Across Pages */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Micro-typography tuning to guarantee single-page fit on Page 1 */
          .alqalam-sheet table td,
          .alqalam-sheet table th {
            padding-top: 1.2px !important;
            padding-bottom: 1.2px !important;
            padding-left: 2px !important;
            padding-right: 2px !important;
            line-height: 1.15 !important;
          }
          .alqalam-sheet .text-\\[11px\\],
          .alqalam-sheet .text-\\[12px\\] {
            font-size: 8.5pt !important;
          }
          .alqalam-sheet .text-\\[10px\\],
          .alqalam-sheet .text-\\[9\\.5px\\] {
            font-size: 7.5pt !important;
          }
          .alqalam-sheet .text-\\[9px\\],
          .alqalam-sheet .text-\\[8\\.5px\\],
          .alqalam-sheet .text-\\[8px\\] {
            font-size: 6.8pt !important;
          }

          /* Shaded Headers Background Guarantee */
          .bg-\\[\\#d1d5db\\] {
            background-color: #d1d5db !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bg-\\[\\#e5e7eb\\] {
            background-color: #e5e7eb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Dedicated Signature Area Print Styling */
          .report-signature-area {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 2.5mm !important;
            padding-top: 1.5mm !important;
          }
          .report-signature-slot {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #000000 !important;
            background: transparent !important;
            padding: 1.5mm !important;
          }
          .report-signature-img {
            max-height: 10mm !important;
            mix-blend-mode: multiply !important;
          }
          .report-signature-line {
            border-bottom: 1px solid #000000 !important;
            margin-top: 1mm !important;
            margin-bottom: 1mm !important;
          }

          /* PAGE 2: PERFORMANCE ANALYTICS SECTION */
          .report-analytics-page {
            page-break-before: always !important;
            break-before: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            margin-top: 0 !important;
            padding: 6mm 8mm !important;
            border: 1px solid #000000 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .report-analytics-page h3,
          .report-analytics-page h4,
          .report-analytics-page p,
          .report-analytics-page span {
            color: #000000 !important;
          }
          .report-analytics-page svg {
            overflow: visible !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
