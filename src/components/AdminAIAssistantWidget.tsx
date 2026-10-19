import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  autoGenerateLessonPlanFn,
  autoGenerateStudentReportSummaryFn,
} from "@/lib/api/ai-hub.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles,
  BookOpen,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Printer,
  Award,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  schoolId?: string | null;
}

export function AdminAIAssistantWidget({ schoolId }: Props) {
  const [activeTab, setActiveTab] = useState<"lesson" | "report">("lesson");

  // Lesson Plan Generator state
  const [lessonClass, setLessonClass] = useState("");
  const [lessonSubject, setLessonSubject] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [lessonWeek, setLessonWeek] = useState("1");
  const [lessonTerm, setLessonTerm] = useState("first");
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [lessonResult, setLessonResult] = useState<any>(null);

  // Student Report Generator state
  const [reportStudent, setReportStudent] = useState("");
  const [reportSession, setReportSession] = useState("2025/2026");
  const [reportTerm, setReportTerm] = useState("third");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);

  // Lookups
  const { data: classes } = useQuery({
    queryKey: ["ai-widget-classes", schoolId],
    queryFn: async () => {
      let q = supabase.from("classes").select("id, name").order("name");
      if (schoolId) q = q.eq("school_id", schoolId);
      return (await q).data ?? [];
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["ai-widget-subjects", schoolId],
    queryFn: async () => {
      let q = supabase.from("subjects").select("id, name").order("name");
      if (schoolId) q = q.eq("school_id", schoolId);
      return (await q).data ?? [];
    },
  });

  const { data: students } = useQuery({
    queryKey: ["ai-widget-students", schoolId],
    queryFn: async () => {
      let q = supabase.from("students").select("id, first_name, last_name, admission_no").order("last_name");
      if (schoolId) q = q.eq("school_id", schoolId);
      return (await q).data ?? [];
    },
  });

  const handleGenerateLesson = async () => {
    if (!schoolId) return toast.error("Please select a school first");
    if (!lessonClass || !lessonSubject) return toast.error("Select both class and subject");
    if (!lessonTopic.trim() || lessonTopic.length < 2) return toast.error("Enter a lesson topic");

    setGeneratingLesson(true);
    setLessonResult(null);
    try {
      const res = await autoGenerateLessonPlanFn({
        data: {
          school_id: schoolId,
          class_id: lessonClass,
          subject_id: lessonSubject,
          topic: lessonTopic.trim(),
          week: Number(lessonWeek) || 1,
          term: lessonTerm,
        },
      });
      setLessonResult(res);
      toast.success("Lesson plan generated and saved as draft!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate lesson plan");
    } finally {
      setGeneratingLesson(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!schoolId) return toast.error("Please select a school first");
    if (!reportStudent) return toast.error("Select a student to evaluate");

    setGeneratingReport(true);
    setReportResult(null);
    try {
      const res = await autoGenerateStudentReportSummaryFn({
        data: {
          school_id: schoolId,
          student_id: reportStudent,
          session: reportSession,
          term: reportTerm,
        },
      });
      setReportResult(res);
      toast.success("Student terminal evaluation generated!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate report evaluation");
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <Card className="border border-primary/20 shadow-md overflow-hidden bg-card">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                Executive AI Assistant
                <Badge variant="outline" className="text-[10px] bg-background font-mono">
                  Gemini Flash Lite
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Auto-generate NERDC-standard lesson plans and terminal report remarks with resilient rate limiting.
              </CardDescription>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="pt-2">
          <TabsList className="grid grid-cols-2 max-w-xs">
            <TabsTrigger value="lesson" className="text-xs gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Lesson Plan
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs gap-1.5">
              <Award className="h-3.5 w-3.5" /> Student Report
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {activeTab === "lesson" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs font-semibold">Class</Label>
                <Select value={lessonClass} onValueChange={setLessonClass}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose Class" /></SelectTrigger>
                  <SelectContent>
                    {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Subject</Label>
                <Select value={lessonSubject} onValueChange={setLessonSubject}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose Subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Week & Term</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Select value={lessonWeek} onValueChange={setLessonWeek}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Week" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 14 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>Wk {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={lessonTerm} onValueChange={setLessonTerm}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Term" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">1st Term</SelectItem>
                      <SelectItem value="second">2nd Term</SelectItem>
                      <SelectItem value="third">3rd Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Topic</Label>
                <Input
                  placeholder="e.g. Fractions & Decimals"
                  value={lessonTopic}
                  onChange={(e) => setLessonTopic(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Automatic exponential retry enabled for 429/503 spikes.
              </span>
              <Button
                onClick={handleGenerateLesson}
                disabled={generatingLesson}
                size="sm"
                className="gap-1.5 text-xs font-semibold"
              >
                {generatingLesson ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating Lesson Plan…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-Generate Plan
                  </>
                )}
              </Button>
            </div>

            {/* Lesson Result Presentation */}
            {lessonResult && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/20 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      {lessonResult.subject} • {lessonResult.topic}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {lessonResult.class_level} • {lessonResult.duration}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(lessonResult, null, 2));
                      toast.success("Copied lesson plan JSON");
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">Specific Objectives:</span>
                    <ul className="list-disc list-inside mt-1 text-muted-foreground space-y-0.5">
                      {lessonResult.specific_objectives?.map((o: string, idx: number) => (
                        <li key={idx}>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Instructional Materials:</span>
                    <ul className="list-disc list-inside mt-1 text-muted-foreground space-y-0.5">
                      {lessonResult.instructional_materials?.map((m: string, idx: number) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {lessonResult.board_summary && (
                  <div className="p-3 rounded bg-background border text-xs">
                    <span className="font-bold text-primary block mb-1">Board Summary & Notes:</span>
                    <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                      {lessonResult.board_summary}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "report" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Select Student</Label>
                <Select value={reportStudent} onValueChange={setReportStudent}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose Student" /></SelectTrigger>
                  <SelectContent>
                    {students?.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.first_name} {st.last_name} ({st.admission_no})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Academic Session</Label>
                <Input
                  value={reportSession}
                  onChange={(e) => setReportSession(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Term</Label>
                <Select value={reportTerm} onValueChange={setReportTerm}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">1st Term</SelectItem>
                    <SelectItem value="second">2nd Term</SelectItem>
                    <SelectItem value="third">3rd Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Aggregates CA1, CA2, Exam scores, GPA and class position into executive remarks.
              </span>
              <Button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                size="sm"
                className="gap-1.5 text-xs font-semibold"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing Performance…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-Generate Evaluation
                  </>
                )}
              </Button>
            </div>

            {/* Student Report Presentation */}
            {reportResult && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/20 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {reportResult.student_name} ({reportResult.admission_no})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {reportResult.class_name} • {reportResult.session} ({reportResult.term} term) • Average: {reportResult.average_score}% • Position: {reportResult.position_in_class}
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-xs">
                    Evaluated
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded bg-background border">
                    <span className="font-bold text-emerald-700 block mb-1">Academic Strengths:</span>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {reportResult.academic_strengths?.map((s: string, idx: number) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded bg-background border">
                    <span className="font-bold text-amber-700 block mb-1">Growth Opportunities:</span>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {reportResult.areas_for_improvement?.map((s: string, idx: number) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded bg-background border">
                    <span className="font-bold text-primary block mb-1">Class Teacher Remark:</span>
                    <p className="italic text-muted-foreground">
                      "{reportResult.teacher_remark}"
                    </p>
                  </div>
                  <div className="p-3 rounded bg-background border">
                    <span className="font-bold text-primary block mb-1">Principal / Headmaster Remark:</span>
                    <p className="italic text-muted-foreground">
                      "{reportResult.principal_remark}"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
