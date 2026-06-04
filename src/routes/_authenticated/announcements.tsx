import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendAnnouncement } from "@/lib/api/announcements.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "Announcements — EduERP" }] }),
  component: Page,
});

function Page() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "news" as "news"|"message"|"general", title: "", body: "", class_id: "" });
  const [busy, setBusy] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["ann-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: recent } = useQuery({
    queryKey: ["ann-recent", schoolId],
    queryFn: async () => (await supabase.from("parent_notifications").select("id, type, title, created_at").in("type", ["news","message","general"]).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    setBusy(true);
    try {
      const r = await sendAnnouncement({ data: { school_id: schoolId, type: form.type, title: form.title, body: form.body, class_id: form.class_id || undefined } });
      toast.success(`Sent to ${r.sent} parents`);
      setForm({ type: "news", title: "", body: "", class_id: "" });
      qc.invalidateQueries({ queryKey: ["ann-recent"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Announcements & Newsletter</h1>
        <p className="text-sm text-muted-foreground">Broadcast news and messages to parents — appears in their portal alerts.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">New broadcast</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">Newsletter / News</SelectItem>
                    <SelectItem value="message">Direct message</SelectItem>
                    <SelectItem value="general">General notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target class (optional)</Label>
                <Select value={form.class_id || "all"} onValueChange={(v) => setForm({ ...form, class_id: v === "all" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All parents</SelectItem>
                    {(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Title</Label><Input required maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Message</Label><Textarea required rows={5} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send to parents"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(recent ?? []).length === 0 && <p className="text-sm text-muted-foreground">No broadcasts yet.</p>}
          {(recent ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <div className="min-w-0"><div className="truncate text-sm font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div></div>
              <Badge variant="outline" className="capitalize">{r.type}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
