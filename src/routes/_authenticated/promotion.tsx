import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/promotion")({
  head: () => ({
    meta: [
      { title: "Session Promotion — EduERP" },
      { name: "description", content: "Promote students to the next class at the end of the session." },
      { property: "og:title", content: "Session Promotion — EduERP" },
      { property: "og:description", content: "Move a whole class to the next class in one click." },
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
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["promo-classes", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["promo-students", from],
    enabled: !!from,
    queryFn: async () => (await supabase.from("students").select("id, admission_no, first_name, last_name").eq("class_id", from).order("last_name")).data ?? [],
  });

  const promote = async () => {
    const ids = (students ?? []).filter((s) => !skip.has(s.id)).map((s) => s.id);
    if (!ids.length) return toast.error("No students selected");
    setBusy(true);
    const { error } = await supabase.from("students").update({ class_id: to === "graduated" ? null : to }).in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} students ${to === "graduated" ? "graduated" : "promoted"}. ${skip.size} kept back.`);
    setSkip(new Set());
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Session promotion</h1>
        <p className="text-sm text-muted-foreground">Move a class to the next class. Untick any student repeating the class.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <Select value={from} onValueChange={(v) => { setFrom(v); setSkip(new Set()); }}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="From class" /></SelectTrigger>
            <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="To class" /></SelectTrigger>
            <SelectContent>
              {classes?.filter((c) => c.id !== from).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              <SelectItem value="graduated">Graduated (leave school)</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={!from || !to || busy} onClick={promote}>{busy ? "Working…" : "Promote"}</Button>
        </CardContent>
      </Card>
      {from && (
        <Card>
          <CardHeader><CardTitle>{students?.length ?? 0} students</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border">
            {students?.map((s) => (
              <label key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <Checkbox checked={!skip.has(s.id)} onCheckedChange={(v) => { const n = new Set(skip); v ? n.delete(s.id) : n.add(s.id); setSkip(n); }} />
                <span className="font-mono text-xs text-muted-foreground">{s.admission_no}</span>
                <span className="font-medium">{s.first_name} {s.last_name}</span>
                {skip.has(s.id) && <span className="ml-auto text-xs text-destructive">Repeating</span>}
              </label>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
