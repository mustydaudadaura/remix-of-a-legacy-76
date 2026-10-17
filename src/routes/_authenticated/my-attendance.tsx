import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { myAttendanceToday, staffPunch } from "@/lib/api/staff-attendance.functions";
import { getLocation } from "@/lib/geo-client";
import { fmtHours, fmtTime } from "@/lib/staff-attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, LogIn, LogOut, MapPin, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-attendance")({
  head: () => ({ meta: [
    { title: "My Attendance — Alegacy" },
    { name: "description", content: "Check in and out of school with location verification and view your own attendance and leave." },
    { property: "og:title", content: "My Attendance — Alegacy" },
    { property: "og:description", content: "Staff check-in and check-out with GPS verification." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MyAttendancePage,
});

function MyAttendancePage() {
  const { schoolId, user } = useAuth();
  if (!schoolId || !user) return <p className="text-muted-foreground">Select a school at the top of the page.</p>;
  return <MyAttendance schoolId={schoolId} userId={user.id} />;
}

function MyAttendance({ schoolId, userId }: { schoolId: string; userId: string }) {
  const qc = useQueryClient();
  const today = useServerFn(myAttendanceToday);
  const punchFn = useServerFn(staffPunch);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({ queryKey: ["my-att", schoolId], queryFn: () => today({ data: { school_id: schoolId } }) });
  const hist = useQuery({ queryKey: ["my-att-hist", schoolId], queryFn: async () => {
    const [rec, pen, leave, types] = await Promise.all([
      supabase.from("staff_attendance").select("date,check_in_at,check_out_at,status,late_minutes,worked_minutes,in_verified,out_verified,correction_reason").eq("school_id", schoolId).eq("user_id", userId).order("date", { ascending: false }).limit(60),
      supabase.from("staff_penalties").select("date,kind,amount,status").eq("school_id", schoolId).eq("user_id", userId).order("date", { ascending: false }).limit(60),
      supabase.from("leave_requests").select("id,start_date,end_date,reason,status,review_note,leave_type_id").eq("school_id", schoolId).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("leave_types").select("id,name").eq("school_id", schoolId).eq("active", true),
    ]);
    return { rec: rec.data ?? [], pen: pen.data ?? [], leave: leave.data ?? [], types: types.data ?? [] };
  } });

  const rec = q.data?.record;
  const action: "in" | "out" | null = !rec?.check_in_at ? "in" : !rec.check_out_at ? "out" : null;

  const go = async () => {
    if (!action) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setResult({ ok: false, text: "No internet connection. Connect and try again — nothing was recorded." }); return; }
    setBusy(true); setResult(null);
    try {
      const loc = q.data?.gps_required ? await getLocation() : await getLocation(6000);
      if (q.data?.gps_required && !loc.fix) { setResult({ ok: false, text: loc.error ?? "Location unavailable." }); return; }
      const r = await punchFn({ data: { school_id: schoolId, action, lat: loc.fix?.lat ?? null, lng: loc.fix?.lng ?? null, accuracy: loc.fix?.accuracy ?? null } });
      const label = action === "in" ? "Check-in" : "Check-out";
      setResult({ ok: true, text: r.already ? `${label} was already recorded at ${fmtTime(r.time)}.` : `${label} successful at ${fmtTime(r.time)}.` });
      qc.invalidateQueries({ queryKey: ["my-att", schoolId] }); qc.invalidateQueries({ queryKey: ["my-att-hist", schoolId] });
    } catch (e) { setResult({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="text-center">
        <CardContent className="space-y-5 py-8">
          {q.isPending ? <p>Loading…</p> : q.error ? <p role="alert">{q.error.message}</p> : <>
            {q.data.photo ? <img src={q.data.photo} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" /> : null}
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide sm:text-3xl">{q.data.name}</h1>
              {q.data.staff_no && <p className="text-sm text-muted-foreground">Staff ID {q.data.staff_no}</p>}
              <p className="mt-1 text-sm text-muted-foreground">{new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div className="text-lg">
              Today: {!rec?.check_in_at ? <Badge variant="secondary">Not checked in</Badge> : <Badge variant={rec.status === "late" ? "destructive" : "default"}>{rec.status === "late" ? `Late (${rec.late_minutes} min)` : "On time"}</Badge>}
              <div className="mt-2 text-sm text-muted-foreground">In {fmtTime(rec?.check_in_at)} · Out {fmtTime(rec?.check_out_at)}{rec?.worked_minutes ? ` · ${fmtHours(rec.worked_minutes)}` : ""}</div>
            </div>
            {action ? (
              <Button size="lg" disabled={busy} onClick={go} className="h-20 w-full max-w-sm text-2xl font-bold">
                {action === "in" ? <LogIn className="mr-2 h-7 w-7" /> : <LogOut className="mr-2 h-7 w-7" />}
                {busy ? "Checking location…" : action === "in" ? "CHECK IN" : "CHECK OUT"}
              </Button>
            ) : <p className="text-lg font-semibold text-primary">You have completed today's attendance.</p>}
            {q.data.gps_required && <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />Your location is checked against the school premises.</p>}
            {result && (
              <div role="status" className={`mx-auto flex max-w-md items-center gap-2 rounded-md border p-3 text-left ${result.ok ? "border-primary text-primary" : "border-destructive text-destructive"}`}>
                {result.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}<span>{result.text}</span>
              </div>
            )}
          </>}
        </CardContent>
      </Card>

      <LeaveRequest schoolId={schoolId} userId={userId} types={hist.data?.types ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["my-att-hist", schoolId] })} />

      <Card>
        <CardHeader><CardTitle>My leave requests</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Dates</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{(hist.data?.leave ?? []).map((l) => <TableRow key={l.id}><TableCell>{l.start_date} → {l.end_date}</TableCell><TableCell>{l.reason}{l.review_note ? <div className="text-xs text-muted-foreground">Note: {l.review_note}</div> : null}</TableCell><TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge></TableCell></TableRow>)}
              {!hist.data?.leave.length && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No leave requests yet.</TableCell></TableRow>}</TableBody></Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My attendance history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead><TableHead>Penalty</TableHead><TableHead>Location</TableHead></TableRow></TableHeader>
            <TableBody>{(hist.data?.rec ?? []).map((r) => {
              const pens = (hist.data?.pen ?? []).filter((p) => p.date === r.date && p.status !== "waived");
              return <TableRow key={r.date}><TableCell>{r.date}</TableCell><TableCell>{fmtTime(r.check_in_at)}</TableCell><TableCell>{fmtTime(r.check_out_at)}</TableCell><TableCell>{r.worked_minutes ? fmtHours(r.worked_minutes) : "—"}</TableCell>
                <TableCell>{r.status === "late" ? `Late ${r.late_minutes}m` : r.status}{r.correction_reason ? <div className="text-xs text-muted-foreground">Corrected</div> : null}</TableCell>
                <TableCell>{pens.length ? `₦${pens.reduce((a, p) => a + Number(p.amount), 0).toLocaleString()}` : "—"}</TableCell>
                <TableCell>{r.in_verified === true ? "Verified" : r.in_verified === false ? "Outside" : "Not checked"}</TableCell></TableRow>;
            })}{!hist.data?.rec.length && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No records yet.</TableCell></TableRow>}</TableBody></Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LeaveRequest({ schoolId, userId, types, onDone }: { schoolId: string; userId: string; types: { id: string; name: string }[]; onDone: () => void }) {
  const [f, setF] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.start_date || !f.end_date || f.reason.trim().length < 3) return toast.error("Fill in the dates and a reason");
    if (f.end_date < f.start_date) return toast.error("End date must be after start date");
    setBusy(true);
    const { error } = await supabase.from("leave_requests").insert({ school_id: schoolId, user_id: userId, leave_type_id: f.leave_type_id || null, start_date: f.start_date, end_date: f.end_date, reason: f.reason.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Leave request sent for approval"); setF({ leave_type_id: "", start_date: "", end_date: "", reason: "" }); onDone();
  };
  return (
    <Card>
      <CardHeader><CardTitle>Request leave</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="lt">Leave type</Label>
          <Select value={f.leave_type_id} onValueChange={(v) => setF({ ...f, leave_type_id: v })}><SelectTrigger id="lt"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="ls">From</Label><Input id="ls" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
        <div><Label htmlFor="le">To</Label><Input id="le" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
        <div className="sm:col-span-3"><Label htmlFor="lr">Reason</Label><Textarea id="lr" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <Button onClick={submit} disabled={busy} className="sm:col-span-3 sm:w-fit">Send request</Button>
      </CardContent>
    </Card>
  );
}
