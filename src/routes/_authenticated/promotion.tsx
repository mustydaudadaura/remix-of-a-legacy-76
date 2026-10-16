import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowRight,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeCumulativeAverage,
  evaluatePromotion,
  resolveSchoolAcademicConfig,
  getScaleForSection,
} from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/promotion")({
  head: () => ({
    meta: [
      { title: "Session Promotion — EduERP" },
      { name: "description", content: "Nigerian 3-Term Cumulative Evaluation & End-of-Session Promotion Engine." },
      { property: "og:title", content: "Session Promotion — EduERP" },
      { property: "og:description", content: "Automate end-of-year class promotions with WAEC/BECE cumulative evaluation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PromotionPage,
});

function PromotionPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // School Academic Configuration
  const { data: schoolData } = useQuery({
    queryKey: ["active-school-academic", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("id, name, current_session, report_template").eq("id", schoolId!).maybeSingle();
      return data;
    },
  });

  const academicConfig = resolveSchoolAcademicConfig(schoolData?.report_template);

  const { data: classes } = useQuery({
    queryKey: ["promo-classes", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name, level, section, arm").order("name")).data ?? [],
  });

  const selectedClass = classes?.find((c) => c.id === from);
  const scaleType = selectedClass ? getScaleForSection(selectedClass.level || selectedClass.section || selectedClass.name) : academicConfig.secondaryScale;
  const isFinalClass = Boolean(
    selectedClass?.name?.toLowerCase().includes("ss 3") ||
    selectedClass?.name?.toLowerCase().includes("sss 3") ||
    selectedClass?.name?.toLowerCase().includes("primary 6") ||
    selectedClass?.name?.toLowerCase().includes("basic 6")
  );

  const { data: students } = useQuery({
    queryKey: ["promo-students", from],
    enabled: !!from,
    queryFn: async () => (await supabase.from("students").select("id, admission_no, first_name, last_name").eq("class_id", from).order("last_name")).data ?? [],
  });

  // Fetch report cards for all students in the selected class across terms
  const { data: reportCards } = useQuery({
    queryKey: ["promo-report-cards", from, schoolData?.current_session],
    enabled: !!from,
    queryFn: async () => {
      let q = supabase.from("report_cards").select("student_id, term, session, average, total_score, position").eq("class_id", from);
      if (schoolData?.current_session) {
        q = q.eq("session", schoolData.current_session);
      }
      return (await q).data ?? [];
    },
  });

  // Fetch assessments for terminal English and Mathematics credit validation
  const { data: assessments } = useQuery({
    queryKey: ["promo-assessments", from],
    enabled: !!from,
    queryFn: async () => {
      const { data } = await supabase.from("assessments").select("student_id, total, grade, subjects(name)").eq("class_id", from);
      return data ?? [];
    },
  });

  // Compute 3-Term Cumulative Evaluation for each student
  const studentEvaluations = useMemo(() => {
    if (!students || !students.length) return [];

    const map = new Map<string, { term1?: number; term2?: number; term3?: number }>();
    (reportCards ?? []).forEach((r: any) => {
      const cur = map.get(r.student_id) || {};
      if (r.term === "first") cur.term1 = Number(r.average);
      if (r.term === "second") cur.term2 = Number(r.average);
      if (r.term === "third") cur.term3 = Number(r.average);
      map.set(r.student_id, cur);
    });

    const assessMap = new Map<string, Array<{ name: string; score: number; grade: string }>>();
    (assessments ?? []).forEach((a: any) => {
      const list = assessMap.get(a.student_id) || [];
      list.push({
        name: a.subjects?.name || "Subject",
        score: Number(a.total) || 0,
        grade: a.grade || "F9",
      });
      assessMap.set(a.student_id, list);
    });

    return students.map((st) => {
      const terms = map.get(st.id) || {};
      const subs = assessMap.get(st.id) || [];
      const cumRes = computeCumulativeAverage(terms.term1, terms.term2, terms.term3, academicConfig.promotionWeighting);

      const evalRes = evaluatePromotion(
        {
          cumulativeAverage: cumRes.cumulativeAverage,
          subjects: subs,
          isFinalClass,
          scaleType,
        },
        {
          passMark: academicConfig.passMark,
          requireEnglish: academicConfig.requireEnglishAndMaths,
          requireMaths: academicConfig.requireEnglishAndMaths,
          weighting: academicConfig.promotionWeighting,
        }
      );

      return {
        student: st,
        term1: terms.term1,
        term2: terms.term2,
        term3: terms.term3,
        cumulativeAverage: cumRes.cumulativeAverage,
        formula: cumRes.formula,
        termsAvailable: cumRes.termsAvailable,
        evaluation: evalRes,
      };
    });
  }, [students, reportCards, assessments, academicConfig, isFinalClass, scaleType]);

  // Handle class selection changes and auto-select eligible students
  const handleFromChange = (newFrom: string) => {
    setFrom(newFrom);
    setSelectedIds(new Set());
  };

  const handleSelectEligible = () => {
    const eligible = new Set<string>();
    studentEvaluations.forEach((item) => {
      if (item.evaluation.decision === "promoted" || item.evaluation.decision === "trial" || item.evaluation.decision === "graduated") {
        eligible.add(item.student.id);
      }
    });
    setSelectedIds(eligible);
    toast.success(`Selected ${eligible.size} eligible student(s) for promotion`);
  };

  const handleSelectAll = () => {
    if (!students) return;
    setSelectedIds(new Set(students.map((s) => s.id)));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const promote = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return toast.error("No students selected for promotion");
    if (!to) return toast.error("Please select a target class or Graduated");

    setBusy(true);
    const { error } = await supabase.from("students").update({ class_id: to === "graduated" ? null : to }).in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);

    const targetLabel = to === "graduated" ? "Graduated" : classes?.find((c) => c.id === to)?.name || "next class";
    toast.success(`${ids.length} student(s) successfully promoted to ${targetLabel}!`);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["promo-students"] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Session Promotion & Academic Evaluation
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              Nigerian Standard
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Evaluates students using the 3-term cumulative composite ({academicConfig.promotionWeighting === "20_20_60" ? "20% T1 + 20% T2 + 60% T3" : "equal weighting"}) and English/Maths credits.
          </p>
        </div>
      </div>

      {/* Class Selector Bar */}
      <Card className="border shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="space-y-1 sm:w-60">
              <span className="text-xs font-semibold text-muted-foreground uppercase">From Class:</span>
              <Select value={from} onValueChange={handleFromChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Source Class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.arm ? `(${c.arm})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block shrink-0 mt-5" />

            <div className="space-y-1 sm:w-60">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Promote To:</span>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Destination Class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.filter((c) => c.id !== from).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.arm ? `(${c.arm})` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="graduated" className="text-primary font-semibold">
                    🎓 Graduated (Terminal Exit)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center mt-2 sm:mt-5">
            <Button
              disabled={!from || !to || !selectedIds.size || busy}
              onClick={promote}
              className="font-semibold shadow-xs"
            >
              <GraduationCap className="mr-2 h-4 w-4" />
              {busy ? "Promoting…" : `Promote (${selectedIds.size}) Students`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roster & Cumulative Evaluation Table */}
      {from && (
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span>{selectedClass?.name} Roster</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {students?.length ?? 0} Students
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Pass benchmark: {academicConfig.passMark}% cumulative · English & Maths credits: {academicConfig.requireEnglishAndMaths ? "Mandatory" : "Optional"}.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleSelectEligible} className="text-xs h-8">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Select Eligible ({studentEvaluations.filter(e => e.evaluation.decision !== "repeat").length})
              </Button>
              <Button size="sm" variant="outline" onClick={handleSelectAll} className="text-xs h-8">
                All
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClearAll} className="text-xs h-8">
                Clear
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center"></TableHead>
                  <TableHead>Adm. No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="text-center">Term 1</TableHead>
                  <TableHead className="text-center">Term 2</TableHead>
                  <TableHead className="text-center">Term 3</TableHead>
                  <TableHead className="text-center font-bold">Cumulative</TableHead>
                  <TableHead>National Status</TableHead>
                  <TableHead>Academic Evaluation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentEvaluations.length ? (
                  studentEvaluations.map(({ student, term1, term2, term3, cumulativeAverage, evaluation }) => {
                    const isSelected = selectedIds.has(student.id);
                    const decision = evaluation.decision;

                    return (
                      <TableRow
                        key={student.id}
                        className={`transition-colors ${
                          isSelected ? "bg-primary/5" : decision === "repeat" ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                        }`}
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedIds);
                              if (checked) next.add(student.id);
                              else next.delete(student.id);
                              setSelectedIds(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {student.admission_no}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.first_name} {student.last_name}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {typeof term1 === "number" ? `${term1}%` : "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {typeof term2 === "number" ? `${term2}%` : "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {typeof term3 === "number" ? `${term3}%` : "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-sm">
                          {cumulativeAverage ? `${cumulativeAverage}%` : "—"}
                        </TableCell>
                        <TableCell>
                          {decision === "promoted" || decision === "graduated" ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px]">
                              <CheckCircle2 className="h-3 w-3" />
                              {evaluation.decisionLabel}
                            </Badge>
                          ) : decision === "trial" ? (
                            <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-[11px]">
                              <AlertTriangle className="h-3 w-3" />
                              Promoted on Trial
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 text-[11px]">
                              <XCircle className="h-3 w-3" />
                              Repeat Class
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={evaluation.reason}>
                          {evaluation.reason}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                      No students found in this class.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
export default PromotionPage;
