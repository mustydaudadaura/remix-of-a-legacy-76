import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getFridayPerformanceDigest,
  sendFridayPerformanceDigest,
} from "@/lib/api/friday-digest.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  MessageSquare,
  Calendar,
  Smartphone,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export function WeeklyFridayDigestManager({
  classes = [],
}: {
  classes?: Array<{ id: string; name: string }>;
}) {
  const { schoolId } = useAuth();

  // Find most recent Friday as default
  const getRecentFriday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day <= 5 ? 5 - day : 5 - day + 7) - (day < 5 ? 7 : 0);
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  };

  const [classId, setClassId] = useState("all");
  const [weekDate, setWeekDate] = useState(getRecentFriday());
  const [channel, setChannel] = useState<"generic" | "whatsapp" | "portal_only">("generic");
  const [includeAi, setIncludeAi] = useState(true);
  const [autoCronEnabled, setAutoCronEnabled] = useState(true);

  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [reportData, setReportData] = useState<Awaited<ReturnType<typeof getFridayPerformanceDigest>> | null>(null);

  if (!schoolId) return null;

  const handlePreview = async () => {
    setBusy("preview");
    try {
      const res = await getFridayPerformanceDigest({
        data: {
          school_id: schoolId,
          class_id: classId === "all" ? undefined : classId,
          week_date: weekDate,
          channel,
          include_ai: includeAi,
        },
      });
      setReportData(res);
      toast.success(`Analysis complete: audited ${res.stats.total} student(s)`);
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze students");
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    if (!reportData?.parent_digests?.length) {
      toast.error("Please run the analysis preview first");
      return;
    }

    setBusy("send");
    try {
      const res = await sendFridayPerformanceDigest({
        data: {
          school_id: schoolId,
          class_id: classId === "all" ? undefined : classId,
          week_date: weekDate,
          channel,
          include_ai: includeAi,
        },
      });

      toast.success(
        `Friday digest dispatched! Sent to ${res.sent} phone(s), filed in ${res.portal_notifications} parent portals.`
      );
      if (res.failed > 0) {
        toast.warning(`${res.failed} SMS/WhatsApp delivery attempt(s) encountered network errors.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch Friday digests");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Configuration Card */}
      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Friday Weekly Parent Digest & Automated Student Analysis
              </CardTitle>
              <CardDescription className="text-xs">
                Audits weekly punctuality, continuous assessment results, and conduct to dispatch a consolidated Friday report to families.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs gap-1 py-1">
              <Zap className="h-3 w-3" />
              Automated Triage Engine
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="fg_class" className="text-xs">Class Scope</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="fg_class" className="text-xs h-9 bg-background mt-1">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All School Classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fg_date" className="text-xs">Week Ending (Friday)</Label>
              <Input
                id="fg_date"
                type="date"
                value={weekDate}
                onChange={(e) => {
                  setWeekDate(e.target.value);
                  setReportData(null);
                }}
                className="text-xs h-9 bg-background mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fg_channel" className="text-xs">Dispatch Method</Label>
              <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                <SelectTrigger id="fg_channel" className="text-xs h-9 bg-background mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">SMS & Parent Portal</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp & Parent Portal</SelectItem>
                  <SelectItem value="portal_only">Parent Portal Only (Zero SMS Cost)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePreview}
                disabled={busy !== null}
                className="w-full text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {busy === "preview" ? "Analyzing Students…" : "Analyze Students"}
              </Button>
            </div>
          </div>

          {/* AI Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/80">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI-Powered Holistic Commentary
              </span>
              <p className="text-[11px] text-muted-foreground">
                Synthesizes attendance trends and test score shifts into encouraging, parent-friendly summaries.
              </p>
            </div>
            <Switch checked={includeAi} onCheckedChange={setIncludeAi} />
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {reportData && (
        <div className="space-y-4">
          {/* Overview Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="text-xs text-muted-foreground font-medium mb-1 flex items-center justify-between">
                <span>Audited Students</span>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-foreground">{reportData.stats.total}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Week ending {reportData.week_end}</p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-sm">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1 flex items-center justify-between">
                <span>Commended / Praise</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {reportData.stats.praise}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">100% punctuality & solid test grades</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-sm">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1 flex items-center justify-between">
                <span>Watchlist</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {reportData.stats.watchlist}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">1 late arrival or minor review needed</p>
            </div>

            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
              <div className="text-xs text-destructive font-medium mb-1 flex items-center justify-between">
                <span>Action Required</span>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-2xl font-bold text-destructive">
                {reportData.stats.action_required}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Unexcused absence or repeated lateness</p>
            </div>
          </div>

          {/* Sample Message & Dispatch Banner */}
          <Card className="rounded-xl border border-border shadow-sm bg-gradient-to-r from-primary/5 via-card to-card">
            <CardHeader className="py-3.5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Live Parent Message Preview (Multi-Child Consolidated)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {reportData.stats.reachable} parent(s) ready to receive. Siblings are merged automatically so families receive only ONE message.
                  </p>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={busy !== null || reportData.stats.reachable === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 gap-1.5 shadow-sm"
                >
                  <Send className="h-3.5 w-3.5" />
                  {busy === "send"
                    ? "Dispatching Friday Updates…"
                    : `Dispatch to ${reportData.stats.reachable} Parent(s)`}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {reportData.sample_message && (
                <div className="rounded-lg border border-border bg-background p-3.5 font-mono text-xs text-foreground leading-relaxed">
                  <div className="text-[10px] text-muted-foreground font-sans uppercase font-bold tracking-wider mb-1">
                    Sample Message Body:
                  </div>
                  {reportData.sample_message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Student Triage Table */}
          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="py-3.5">
              <CardTitle className="text-sm font-semibold">Weekly Student Analysis Roster</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Punctuality & Attendance</TableHead>
                      <TableHead>Academic Standing</TableHead>
                      <TableHead>Status Flag</TableHead>
                      <TableHead>Recommended Parent Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.student_analyses.map((item) => {
                      const s = item.student;
                      const flagVariant =
                        item.overall_flag === "praise"
                          ? "default"
                          : item.overall_flag === "watchlist"
                          ? "secondary"
                          : "destructive";

                      return (
                        <TableRow key={s.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="font-semibold text-xs text-foreground">{s.name}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <span className="font-mono">{s.admission_no}</span>
                              {s.class_name && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                  {s.class_name}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-emerald-600">{s.present} present</span>
                              {s.late > 0 && <span className="text-amber-600 font-medium">({s.late} late)</span>}
                              {s.absent > 0 && <span className="text-destructive font-bold">({s.absent} absent)</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {item.punctuality_summary}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs">
                            {s.average_score != null ? (
                              <div>
                                <span className="font-bold text-foreground">{Math.round(s.average_score)}%</span>{" "}
                                <span className="text-muted-foreground">test avg</span>
                                <div className="text-[11px] text-muted-foreground">{item.academic_summary}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No assessment recorded</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={flagVariant}
                              className={`text-[10px] capitalize ${
                                item.overall_flag === "praise"
                                  ? "bg-emerald-600 text-white"
                                  : item.overall_flag === "watchlist"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300"
                                  : ""
                              }`}
                            >
                              {item.overall_flag.replace("_", " ")}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            {item.recommended_action}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Automated Scheduling Information Card */}
      <Card className="rounded-xl border border-border shadow-sm bg-muted/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Unattended Automated Friday Scheduling
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The portal automatically analyzes every student every Friday afternoon at 3:00 PM WAT, merges siblings, and notifies parents without requiring manual bursary clicks.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground font-medium">Automatic Execution:</span>
              <Switch checked={autoCronEnabled} onCheckedChange={setAutoCronEnabled} />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-muted-foreground font-sans text-[11px]">
              <span>Recurring Schedule (Cron Pattern):</span>
              <span className="font-semibold text-foreground font-mono">0 15 * * 5 (Every Friday 3:00 PM WAT)</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground font-sans text-[11px]">
              <span>Notification Channels:</span>
              <span className="font-semibold text-foreground font-mono">Termii SMS / WhatsApp + Parent Portal Dashboard</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground font-sans text-[11px]">
              <span>Audit Logging:</span>
              <span className="font-semibold text-emerald-600 font-sans">Active & Append-Only in Database</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
