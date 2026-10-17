import { useState } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  CalendarCheck,
  Award,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  Users,
  Smartphone,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  sendWeeklyAttendanceDigest,
  sendReportCardReleaseAnnouncement,
} from "@/lib/api/nigerian-fees.functions";

interface ParentAlertBroadcasterProps {
  schoolId: string;
  classes: { id: string; name: string }[];
  currentSession: string;
}

export function ParentAlertBroadcaster({
  schoolId,
  classes,
  currentSession,
}: ParentAlertBroadcasterProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"attendance" | "reports" | "receipts">("attendance");
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<"whatsapp" | "generic">("whatsapp");

  // Attendance Digest State
  const today = new Date();
  const pastMonday = new Date(today);
  pastMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const pastFriday = new Date(pastMonday);
  pastFriday.setDate(pastMonday.getDate() + 4);

  const [weekStart, setWeekStart] = useState(pastMonday.toISOString().slice(0, 10));
  const [weekEnd, setWeekEnd] = useState(pastFriday.toISOString().slice(0, 10));
  const [attClassId, setAttClassId] = useState<string>("all");

  // Report Card Announcement State
  const [reportTerm, setReportTerm] = useState<"first" | "second" | "third">("second");
  const [reportClassId, setReportClassId] = useState<string>("all");
  const [customNote, setCustomNote] = useState("School resumes for next term on Monday, May 4th. Check portal for results.");

  const handleSendAttendanceDigest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await sendWeeklyAttendanceDigest({
        data: {
          school_id: schoolId,
          class_id: attClassId === "all" ? undefined : attClassId,
          week_start: weekStart,
          week_end: weekEnd,
          channel,
        },
      });
      toast.success(`Dispatched weekly attendance digest to ${res.sentCount} parent numbers!`);
      setOpen(false);
    } catch (err: any) {
      toast.error("Digest broadcast failed: " + (err?.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const handleSendReportAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await sendReportCardReleaseAnnouncement({
        data: {
          school_id: schoolId,
          session: currentSession || "2026/2027",
          term: reportTerm,
          class_id: reportClassId === "all" ? undefined : reportClassId,
          custom_note: customNote,
          channel,
        },
      });
      toast.success(`Published termly result alerts to ${res.sentCount} parent phones!`);
      setOpen(false);
    } catch (err: any) {
      toast.error("Announcement failed: " + (err?.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
          WhatsApp & SMS Digests
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border bg-card/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              Parent Communication & Digest Center
            </DialogTitle>
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                  channel === "whatsapp" ? "bg-emerald-600 text-white" : "text-muted-foreground"
                }`}
              >
                WhatsApp (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setChannel("generic")}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                  channel === "generic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                SMS
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="attendance" className="text-xs">
                <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />
                Weekly Attendance Digest
              </TabsTrigger>
              <TabsTrigger value="reports" className="text-xs">
                <Award className="mr-1.5 h-3.5 w-3.5" />
                Termly Report Release
              </TabsTrigger>
            </TabsList>

            {/* Attendance Digest Tab */}
            <TabsContent value="attendance">
              <form onSubmit={handleSendAttendanceDigest} className="space-y-3.5 text-xs">
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <p className="font-semibold text-foreground">Weekly Digest Template Preview</p>
                  <p className="text-[11px] text-muted-foreground font-mono bg-card p-2 rounded border border-border">
                    *WEEKLY ATTENDANCE DIGEST*<br />
                    Student: [First Name] [Last Name] (JSS 1A)<br />
                    Period: {weekStart} to {weekEnd}<br />
                    • Present: 5 days (100%)<br />
                    • Absent: 0 days<br />
                    Thank you for keeping your child punctual.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px]">Week Start</Label>
                    <Input
                      type="date"
                      value={weekStart}
                      onChange={(e) => setWeekStart(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Week End</Label>
                    <Input
                      type="date"
                      value={weekEnd}
                      onChange={(e) => setWeekEnd(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px]">Target Class</Label>
                  <Select value={attClassId} onValueChange={setAttClassId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes in School</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={busy} className="w-full text-xs font-semibold shadow-sm">
                  {busy ? (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Broadcasting Attendance Digest…
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Send Weekly Digest via {channel === "whatsapp" ? "WhatsApp" : "SMS"}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Report Release Tab */}
            <TabsContent value="reports">
              <form onSubmit={handleSendReportAnnouncement} className="space-y-3.5 text-xs">
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <p className="font-semibold text-foreground">Termly Report Card Announcement Preview</p>
                  <p className="text-[11px] text-muted-foreground font-mono bg-card p-2 rounded border border-border">
                    *TERMLY REPORT CARD RELEASE*<br />
                    Term: {reportTerm.toUpperCase()} TERM {currentSession || "2026/2027"}<br />
                    Student: [Student Name] ([Class])<br />
                    • Terminal Average: 84.5%<br />
                    • Position: #3 in class<br />
                    Log in to your Parent Portal to view and download full report card.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px]">Academic Term</Label>
                    <Select value={reportTerm} onValueChange={(v: any) => setReportTerm(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">First Term</SelectItem>
                        <SelectItem value="second">Second Term</SelectItem>
                        <SelectItem value="third">Third Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Target Class</Label>
                    <Select value={reportClassId} onValueChange={setReportClassId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px]">Resumption Notice / Custom Remark</Label>
                  <Input
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Resumption date is May 4th, 2026."
                    className="h-8 text-xs"
                  />
                </div>

                <Button type="submit" disabled={busy} className="w-full text-xs font-semibold shadow-sm">
                  {busy ? (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Broadcasting Report Announcements…
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Broadcast Report Card Release Alert
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
