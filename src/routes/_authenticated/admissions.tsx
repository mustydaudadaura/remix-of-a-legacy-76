import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, ListFilter } from "lucide-react";
import { toast } from "sonner";
import { AiAdmissionAssistant } from "@/components/admissions/AiAdmissionAssistant";

export const Route = createFileRoute("/_authenticated/admissions")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({ meta: [{ title: "Admissions — EduERP" }, { name: "description", content: "Track applicants from inquiry to enrollment." }, { property: "og:title", content: "Admissions — EduERP" }, { property: "og:description", content: "Track applicants from inquiry to enrollment." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AdmissionsPage,
});

const STAGES = ["inquiry", "applied", "screened", "accepted", "rejected", "enrolled"] as const;
const EMPTY = { first_name: "", last_name: "", middle_name: "", gender: "male", dob: "", class_applied_id: "", previous_school: "", parent_name: "", parent_phone: "", parent_email: "", relationship: "father", notes: "" };

function AdmissionsPage() {
  const { schoolId } = useAuth();
  const { can } = useSchoolAccess();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState(EMPTY);

  const { data: apps } = useQuery({
    queryKey: ["admissions", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from("admissions").select("*, classes(name)").eq("school_id", schoolId!).order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-adm", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("classes").select("id, name").eq("school_id", schoolId!).order("name")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admissions"] });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Select a school first");
    const application_no = `APP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { error } = await supabase.from("admissions").insert({ ...form, gender: form.gender as "male" | "female", dob: form.dob || null, class_applied_id: form.class_applied_id || null, school_id: schoolId, application_no });
    if (error) return toast.error(error.message);
    toast.success(`Application ${application_no} created`); setOpen(false); setForm(EMPTY); refresh();
  };

  const setStage = async (id: string, stage: string, score?: string) => {
    const patch: any = { stage };
    if (score !== undefined) patch.entrance_score = score === "" ? null : Number(score);
    const { error } = await supabase.from("admissions").update(patch).eq("id", id);
    if (error) return toast.error(error.message); refresh();
  };

  const enroll = async (a: any) => {
    const admission_no = window.prompt("Admission number for this student:", a.application_no.replace("APP", "ADM"));
    if (!admission_no) return;
    const { data: st, error } = await supabase.from("students").insert({
      school_id: a.school_id, admission_no, first_name: a.first_name, last_name: a.last_name, middle_name: a.middle_name,
      gender: a.gender, dob: a.dob, class_id: a.class_applied_id, previous_school: a.previous_school, state_of_origin: a.state_of_origin,
      admission_date: new Date().toISOString().slice(0, 10),
    }).select("id").single();
    if (error) return toast.error(error.message);
    if (a.parent_name) {
      let parentId: string | undefined;
      if (a.parent_phone) parentId = (await supabase.from("parents").select("id").eq("school_id", a.school_id).eq("phone", a.parent_phone).maybeSingle()).data?.id;
      if (!parentId) parentId = (await supabase.from("parents").insert({ school_id: a.school_id, full_name: a.parent_name, phone: a.parent_phone || null, email: a.parent_email || null }).select("id").single()).data?.id;
      if (parentId) await supabase.from("student_parents").insert({ student_id: st.id, parent_id: parentId, relationship: a.relationship, is_primary: true });
    }
    await supabase.from("admissions").update({ stage: "enrolled", student_id: st.id }).eq("id", a.id);
    toast.success("Student enrolled and parent linked"); refresh();
  };

  const search = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = search?.tab === "ai-assistant" ? "ai-assistant" : "list";

  const counts = Object.fromEntries(STAGES.map((s) => [s, apps?.filter((a) => a.stage === s).length ?? 0]));
  const list = (apps ?? []).filter((a) => filter === "all" || a.stage === filter);
  const editable = can("students.edit");

  return (
    <div className="space-y-6">
      {/* Top Tab Switcher */}
      <div className="flex border-b border-border space-x-1">
        <button
          type="button"
          onClick={() => navigate({ to: "/admissions", search: { tab: "list" } })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "list"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListFilter className="h-4 w-4" />
          Applications & Enrollment
          {apps?.length ? (
            <Badge variant="secondary" className="text-xs ml-1">
              {apps.length}
            </Badge>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => navigate({ to: "/admissions", search: { tab: "ai-assistant" } })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "ai-assistant"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          AI Admission Assistant
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 ml-1">
            New
          </Badge>
        </button>
      </div>

      {activeTab === "ai-assistant" ? (
        <AiAdmissionAssistant
          onDone={refresh}
          onNavigateToAdmissions={() => navigate({ to: "/admissions", search: { tab: "list" } })}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admissions</h1>
              <p className="text-sm text-muted-foreground">Track applicants from inquiry to enrollment.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => navigate({ to: "/admissions", search: { tab: "ai-assistant" } })}
              >
                <Sparkles className="mr-2 h-4 w-4 text-primary" /> AI Capture & Register
              </Button>

              {editable && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> New application
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>New application</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={create} className="grid grid-cols-2 gap-3">
                      {([
                        ["first_name", "First name", true],
                        ["last_name", "Last name", true],
                        ["middle_name", "Middle name"],
                        ["dob", "Date of birth"],
                        ["previous_school", "Previous school"],
                        ["parent_name", "Parent name"],
                        ["parent_phone", "Parent phone"],
                        ["parent_email", "Parent email"],
                      ] as [keyof typeof EMPTY, string, boolean?][]).map(([k, l, req]) => (
                        <div key={k}>
                          <Label>{l}</Label>
                          <Input
                            required={req}
                            type={k === "dob" ? "date" : "text"}
                            value={form[k]}
                            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                          />
                        </div>
                      ))}
                      <div>
                        <Label>Gender</Label>
                        <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Relationship</Label>
                        <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["father", "mother", "guardian", "sponsor"].map((r) => (
                              <SelectItem key={r} value={r} className="capitalize">
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Class applied for</Label>
                        <Select value={form.class_applied_id} onValueChange={(v) => setForm({ ...form, class_applied_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Notes</Label>
                        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                      </div>
                      <Button type="submit" className="col-span-2">
                        Save application
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:grid-cols-7">
            {["all", ...STAGES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-md border p-2 text-left text-sm capitalize ${
                  filter === s ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <span className="block text-xs text-muted-foreground">{s}</span>
                <span className="font-semibold">{s === "all" ? apps?.length ?? 0 : counts[s]}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {list.length ? (
              list.map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {a.first_name} {a.last_name}{" "}
                        <Badge variant="outline" className="ml-1 capitalize">
                          {a.stage}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.application_no} · {a.classes?.name ?? "No class"} · {a.parent_name ?? "No parent"}{" "}
                        {a.parent_phone ?? ""}
                      </p>
                    </div>
                    {editable && a.stage !== "enrolled" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          className="w-24"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="Score"
                          defaultValue={a.entrance_score ?? ""}
                          onBlur={(e) =>
                            e.target.value !== String(a.entrance_score ?? "") && setStage(a.id, a.stage, e.target.value)
                          }
                        />
                        <Select value={a.stage} onValueChange={(v) => setStage(a.id, v)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.filter((s) => s !== "enrolled").map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {a.stage === "accepted" && (
                          <Button size="sm" onClick={() => enroll(a)}>
                            Enroll
                          </Button>
                        )}
                      </div>
                    )}
                    {a.student_id && (
                      <Link to="/students/$id" params={{ id: a.student_id }} className="text-sm text-primary hover:underline">
                        View student
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No applications.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
