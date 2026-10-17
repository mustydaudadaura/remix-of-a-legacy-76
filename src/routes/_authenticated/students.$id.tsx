import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Student Profile — Alegacy" }, { name: "description", content: "Complete student profile: biodata, guardians, academics and fees." }, { property: "og:title", content: "Student Profile — Alegacy" }, { property: "og:description", content: "Complete student profile: biodata, guardians, academics and fees." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: StudentProfile,
});

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;
const BIO = [
  ["blood_group", "Blood group"], ["genotype", "Genotype"], ["allergies", "Allergies"], ["medical_notes", "Medical notes"],
  ["state_of_origin", "State of origin"], ["lga", "LGA"], ["religion", "Religion"], ["address", "Address"],
  ["previous_school", "Previous school"], ["house", "House"], ["emergency_contact_name", "Emergency contact"], ["emergency_contact_phone", "Emergency phone"],
] as const;

function StudentProfile() {
  const { id } = Route.useParams();
  const { can } = useSchoolAccess();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isPending, error } = useQuery({
    queryKey: ["student-360", id],
    queryFn: async () => {
      const [s, links, history, cards, invoices, att] = await Promise.all([
        supabase.from("students").select("*, classes(name), campuses(name)").eq("id", id).maybeSingle(),
        supabase.from("student_parents").select("relationship, is_primary, parents(id, full_name, phone, email, occupation)").eq("student_id", id),
        supabase.from("student_enrollments").select("id, event, session, created_at, classes(name)").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("report_cards").select("id, session, term, average, position, published").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("fee_invoices").select("id, title, session, term, amount_due, amount_paid, status").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("attendance").select("status").eq("student_id", id),
      ]);
      if (s.error) throw s.error;
      return { student: s.data, links: links.data ?? [], history: history.data ?? [], cards: cards.data ?? [], invoices: invoices.data ?? [], att: att.data ?? [] };
    },
  });

  if (isPending) return <p className="text-muted-foreground">Loading profile…</p>;
  if (error || !data?.student) return <p className="text-muted-foreground">Student not found or you don't have access.</p>;
  const s: any = data.student;
  const present = data.att.filter((a: any) => a.status === "present" || a.status === "late").length;
  const due = data.invoices.reduce((t: number, i: any) => t + Number(i.amount_due), 0);
  const paid = data.invoices.reduce((t: number, i: any) => t + Number(i.amount_paid), 0);

  const save = async () => {
    const patch: Record<string, string | null> = {};
    BIO.forEach(([k]) => { if (k in form) patch[k] = form[k] || null; });
    const { error } = await supabase.from("students").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated"); setEditing(false); setForm({});
    qc.invalidateQueries({ queryKey: ["student-360", id] });
  };

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" /> All students</Link>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-bold text-primary">
            {s.photo_url ? <img src={s.photo_url} alt="" className="h-full w-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{s.first_name} {s.middle_name ?? ""} {s.last_name}</h1>
            <p className="text-sm text-muted-foreground">{s.admission_no} · {s.classes?.name ?? "No class"}{s.campuses?.name ? ` · ${s.campuses.name}` : ""}</p>
          </div>
          <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status}</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Attendance", data.att.length ? `${Math.round((present / data.att.length) * 100)}%` : "—"], ["Report cards", data.cards.length], ["Fees paid", naira(paid)], ["Balance", naira(due - paid)]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-semibold">{v}</p></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="bio">
        <TabsList className="flex w-full flex-wrap h-auto">
          <TabsTrigger value="bio">Biodata</TabsTrigger><TabsTrigger value="family">Guardians</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger><TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>
        <TabsContent value="bio">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Biodata & medical</CardTitle>
              {can("students.edit") && (editing ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button size="sm" onClick={save}>Save</Button></div> : <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>)}
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Gender" value={s.gender} /><Field label="Date of birth" value={s.dob} /><Field label="Admitted" value={s.admission_date} />
              {BIO.map(([k, l]) => editing
                ? <div key={k}><Label>{l}</Label><Input defaultValue={s[k] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} /></div>
                : <Field key={k} label={l} value={s[k]} />)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="family">
          <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            {data.links.length ? data.links.map((l: any) => (
              <div key={l.parents?.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{l.parents?.full_name} {l.is_primary && <Badge variant="secondary" className="ml-1">Primary</Badge>}</p>
                <p className="text-sm capitalize text-muted-foreground">{l.relationship ?? "Guardian"}</p>
                <p className="text-sm">{l.parents?.phone ?? "—"}</p><p className="text-sm text-muted-foreground">{l.parents?.email}</p>
              </div>
            )) : <p className="text-muted-foreground">No guardians linked.</p>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="academic" className="space-y-4">
          <Card><CardHeader><CardTitle>Report cards</CardTitle></CardHeader><CardContent className="space-y-2">
            {data.cards.length ? data.cards.map((c: any) => (
              <Link key={c.id} to="/report-card/$id" params={{ id: c.id }} className="flex justify-between rounded-md border border-border p-3 text-sm hover:bg-muted/50">
                <span>{c.session} · <span className="capitalize">{c.term}</span> term</span>
                <span>Avg {c.average ?? "—"} · Pos {c.position ?? "—"} {!c.published && <Badge variant="outline">Draft</Badge>}</span>
              </Link>
            )) : <p className="text-muted-foreground">No report cards yet.</p>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Enrollment history</CardTitle></CardHeader><CardContent className="space-y-2">
            {data.history.map((h: any) => (
              <div key={h.id} className="flex justify-between text-sm"><span className="capitalize">{h.event.replace("_", " ")} — {h.classes?.name ?? "—"}</span><span className="text-muted-foreground">{h.session ?? ""} · {new Date(h.created_at).toLocaleDateString()}</span></div>
            ))}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="fees">
          <Card><CardContent className="space-y-2 p-4">
            {data.invoices.length ? data.invoices.map((i: any) => (
              <div key={i.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-border p-3 text-sm">
                <span>{i.title} <span className="text-muted-foreground">({i.session}, {i.term})</span></span>
                <span>{naira(i.amount_paid)} / {naira(i.amount_due)} <Badge variant="outline" className="capitalize">{i.status}</Badge></span>
              </div>
            )) : <p className="text-muted-foreground">No invoices.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="capitalize-first text-sm">{value || "—"}</p></div>;
}
