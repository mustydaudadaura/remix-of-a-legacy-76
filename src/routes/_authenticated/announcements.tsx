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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Megaphone } from "lucide-react";
import { WeeklyFridayDigestManager } from "@/components/WeeklyFridayDigestManager";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Parent Communication & Friday Digest — EduERP" },
      { name: "description", content: "Weekly Friday student performance & punctuality analysis, automated digest, and school broadcasts." },
      { property: "og:title", content: "Parent Communication & Friday Digest — EduERP" },
      { property: "og:description", content: "Weekly Friday student performance & punctuality analysis, automated digest, and school broadcasts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type MsgType = "news" | "message" | "general";
const empty = { type: "news" as MsgType, title: "", body: "", class_id: "", publish_at: "" };

function Page() {
  const { schoolId, user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("friday-digest");
  const [form, setForm] = useState(empty);
  const [tplName, setTplName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["ann-classes", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name").eq("school_id", schoolId!).order("name")).data ?? [],
    enabled: !!schoolId,
  });
  const { data: templates } = useQuery({
    queryKey: ["msg-templates", schoolId],
    queryFn: async () => (await supabase.from("message_templates").select("id, name, type, title, body").eq("school_id", schoolId!).order("name")).data ?? [],
    enabled: !!schoolId,
  });
  const { data: recent } = useQuery({
    queryKey: ["ann-recent", schoolId],
    queryFn: async () => {
      const rows = (await supabase.from("parent_notifications").select("id, type, title, created_at, visible_from").eq("school_id", schoolId!).in("type", ["news", "message", "general"]).order("created_at", { ascending: false }).limit(300)).data ?? [];
      // Group per broadcast (same title + send time)
      const groups = new Map<string, { title: string; type: string; visible_from: string; count: number }>();
      for (const r of rows) {
        const k = `${r.title}|${r.created_at.slice(0, 19)}`;
        const g = groups.get(k);
        if (g) g.count++; else groups.set(k, { title: r.title, type: r.type, visible_from: r.visible_from, count: 1 });
      }
      return Array.from(groups.values()).slice(0, 20);
    },
    enabled: !!schoolId,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    let publish_at: string | undefined;
    if (form.publish_at) {
      const d = new Date(form.publish_at);
      if (isNaN(d.getTime())) return toast.error("Pick a valid date and time");
      if (d.getTime() > Date.now()) publish_at = d.toISOString();
    }
    setBusy(true);
    try {
      const r = await sendAnnouncement({ data: { school_id: schoolId, type: form.type, title: form.title, body: form.body, class_id: form.class_id || undefined, publish_at } });
      const when = publish_at ? ` — families will see it ${new Date(publish_at).toLocaleString()}` : "";
      toast.success(`Sent to ${r.sent} parents${r.skipped ? ` (${r.skipped} turned this type off)` : ""}${when}`);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["ann-recent"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const saveTemplate = async () => {
    if (!schoolId || !user) return;
    if (tplName.trim().length < 2) return toast.error("Give the template a name");
    if (form.title.trim().length < 2 || form.body.trim().length < 2) return toast.error("Write a title and message first");
    const { error } = await supabase.from("message_templates").insert({ school_id: schoolId, name: tplName.trim(), type: form.type, title: form.title, body: form.body, created_by: user.id });
    if (error) return toast.error(error.message);
    toast.success("Template saved");
    setTplName("");
    qc.invalidateQueries({ queryKey: ["msg-templates"] });
  };
  const removeTemplate = async (id: string) => {
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["msg-templates"] });
  };

  const scheduled = (v: string) => new Date(v).getTime() > Date.now();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Communication & Parent Updates</h1>
        <p className="text-sm text-muted-foreground">
          Send weekly Friday automated student updates, review AI performance triage, or dispatch school-wide announcements.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="friday-digest" className="gap-1.5 text-xs sm:text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Friday Digest & AI Student Analysis
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="gap-1.5 text-xs sm:text-sm">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            Broadcast Newsletters & Notices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friday-digest" className="space-y-4">
          <WeeklyFridayDigestManager classes={classes ?? []} />
        </TabsContent>

        <TabsContent value="broadcasts" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">New broadcast</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="ann_type">Type</Label>
                  <Select value={form.type} onValueChange={(v: MsgType) => setForm({ ...form, type: v })}>
                    <SelectTrigger id="ann_type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="news">Newsletter / News</SelectItem>
                      <SelectItem value="message">Direct message</SelectItem>
                      <SelectItem value="general">General notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ann_class">Send to</Label>
                  <Select value={form.class_id || "all"} onValueChange={(v) => setForm({ ...form, class_id: v === "all" ? "" : v })}>
                    <SelectTrigger id="ann_class"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All parents</SelectItem>
                      {(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} parents</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ann_when">Show to families from (optional)</Label>
                  <Input id="ann_when" type="datetime-local" value={form.publish_at} onChange={(e) => setForm({ ...form, publish_at: e.target.value })} />
                </div>
              </div>
              <div><Label htmlFor="ann_title">Title</Label><Input id="ann_title" required maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <Label htmlFor="ann_body">Message</Label>
                <Textarea id="ann_body" required rows={6} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Write {"{parent_name}"} or {"{school_name}"} and each family sees their own name.</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button type="submit" disabled={busy}>{busy ? "Sending…" : form.publish_at ? "Schedule" : "Send now"}</Button>
                <div className="ml-auto flex items-end gap-2">
                  <div><Label htmlFor="tpl_name" className="text-xs">Save as template</Label><Input id="tpl_name" placeholder="e.g. Resumption notice" value={tplName} onChange={(e) => setTplName(e.target.value)} className="h-9 w-48" /></div>
                  <Button type="button" variant="outline" onClick={saveTemplate}>Save</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(templates ?? []).length === 0 && <p className="text-sm text-muted-foreground">No templates yet. Write a message and save it to reuse every term.</p>}
            {(templates ?? []).map((t) => (
              <div key={t.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setForm({ ...form, type: t.type as MsgType, title: t.title, body: t.body }); toast.success(`Loaded "${t.name}"`); }}>
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.title}</div>
                </button>
                <Button size="icon" variant="ghost" aria-label={`Delete template ${t.name}`} onClick={() => removeTemplate(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent broadcasts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(recent ?? []).length === 0 && <p className="text-sm text-muted-foreground">No broadcasts yet.</p>}
          {(recent ?? []).map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
              <div className="min-w-0"><div className="truncate text-sm font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.count} parents · {new Date(r.visible_from).toLocaleString()}</div></div>
              <div className="flex shrink-0 gap-1">
                {scheduled(r.visible_from) && <Badge>Scheduled</Badge>}
                <Badge variant="outline" className="capitalize">{r.type}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      </TabsContent>
    </Tabs>
    </div>
  );
}
