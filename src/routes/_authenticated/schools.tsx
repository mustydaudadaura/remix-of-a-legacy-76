import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Settings2, RefreshCw, Copy, Wand2, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";

// Build a school code like "HGA-001" from the school name.
// Uses up to 3 initials + 3-digit random suffix, checks uniqueness in DB.
async function generateUniqueSchoolCode(name: string): Promise<string> {
  const initials =
    (name || "SCH")
      .replace(/[^A-Za-z\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "SCH";
  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = String(Math.floor(Math.random() * 900) + 100);
    const code = `${initials}-${suffix}`;
    const { data } = await supabase.from("schools").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return `${initials}-${Date.now().toString().slice(-4)}`;
}

export const Route = createFileRoute("/_authenticated/schools")({
  head: () => ({ meta: [{ title: "Schools — Alegacy" }, { name: "description", content: "Schools for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Schools — Alegacy" }, { property: "og:description", content: "Schools for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SchoolsPage,
});

type School = {
  id: string; name: string; code: string; address: string | null;
  phone: string | null; email: string | null; motto: string | null;
  logo_url: string | null; stamp_url: string | null; website: string | null;
  branch_name: string | null; principal_name: string | null;
  principal_signature_url: string | null; current_session: string | null;
  facebook_url: string | null; instagram_url: string | null; twitter_url: string | null;
  theme_color?: string | null;
};

async function uploadFile(file: File, prefix: string): Promise<string> {
  try {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("school-assets").upload(path, file, { upsert: true });
    if (!error) {
      const publicUrl = supabase.storage.from("school-assets").getPublicUrl(path).data.publicUrl;
      if (publicUrl && !publicUrl.includes("placeholder")) return publicUrl;
    }
  } catch {
    // Fall back to data URL for seamless local/preview persistence
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

function SchoolsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", email: "", motto: "", current_session: "2025/2026" });

  const { data: schools, isLoading } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as School[];
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    let code = form.code.trim().toUpperCase();
    if (!code) code = await generateUniqueSchoolCode(form.name);
    const { error } = await supabase.from("schools").insert({ ...form, code });
    if (error) return toast.error(error.message);
    toast.success(`School created · code ${code}`);
    setOpen(false);
    setForm({ name: "", code: "", address: "", phone: "", email: "", motto: "", current_session: "2025/2026" });
    qc.invalidateQueries({ queryKey: ["schools"] });
    qc.invalidateQueries({ queryKey: ["layout-schools"] });
  };

  const regenerateCode = async (s: School) => {
    if (!confirm(`Regenerate code for ${s.name}? Users signing up with the old code (${s.code}) will fail.`)) return;
    const code = await generateUniqueSchoolCode(s.name);
    const { error } = await supabase.from("schools").update({ code }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(`New code: ${code}`);
    qc.invalidateQueries({ queryKey: ["schools"] });
    qc.invalidateQueries({ queryKey: ["layout-schools"] });
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schools</h1>
          <p className="text-sm text-muted-foreground">Manage schools, branding, and report card identity.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New school</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create school</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div>
                  <Label>Code</Label>
                  <div className="flex gap-1">
                    <Input
                      required
                      placeholder="Auto-generated"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Generate code"
                      onClick={async () => setForm({ ...form, code: await generateUniqueSchoolCode(form.name) })}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="col-span-2"><Label>Motto</Label><Input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></div>
                <div><Label>Session</Label><Input value={form.current_session} onChange={(e) => setForm({ ...form, current_session: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All schools</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead>
                  <TableHead>Session</TableHead><TableHead>Phone</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools?.length ? schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {s.logo_url && <img src={s.logo_url} className="h-7 w-7 object-contain rounded" alt="" />}
                      {s.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{s.code}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCode(s.code)} title="Copy">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => regenerateCode(s)} title="Regenerate">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{s.current_session ?? "—"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(s)}>
                          <Settings2 className="mr-1 h-3.5 w-3.5" /> Branding
                        </Button>
                        <Button size="sm" variant="secondary" className="h-8 text-xs font-medium" asChild>
                          <Link to="/s/$slug" params={{ slug: s.code.toLowerCase() }} target="_blank">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> View Website
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No schools yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditBrandingDialog
        school={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["schools"] });
          qc.invalidateQueries({ queryKey: ["layout-schools"] });
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditBrandingDialog({ school, onClose, onSaved }: { school: School | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Partial<School>>({});
  const [saving, setSaving] = useState(false);

  if (!school) return null;
  const s = { ...school, ...draft };

  const setF = (k: keyof School, v: string | null) => setDraft({ ...draft, [k]: v });

  const onFile = async (k: keyof School, prefix: string, file: File | undefined) => {
    if (!file) return;
    try {
      const url = await uploadFile(file, `${school.id}/${prefix}`);
      setF(k, url);
      toast.success("Uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("schools").update(draft).eq("id", school.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>School branding — {school.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Public Website & Portal URL */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Official School Website: </span>
                <code className="text-primary font-mono font-medium">/s/{school.code.toLowerCase()}</code>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-1 sm:flex-none"
                onClick={() => {
                  const url = typeof window !== "undefined" ? `${window.location.origin}/s/${school.code.toLowerCase()}` : `/s/${school.code.toLowerCase()}`;
                  navigator.clipboard.writeText(url);
                  toast.success("School website link copied to clipboard!");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy Link
              </Button>
              <Button size="sm" variant="default" className="h-7 text-xs flex-1 sm:flex-none" asChild>
                <Link to="/s/$slug" params={{ slug: school.code.toLowerCase() }} target="_blank">
                  <ExternalLink className="h-3 w-3 mr-1" /> Open Website
                </Link>
              </Button>
            </div>
          </div>

          {/* Theme Color */}
          <div className="space-y-1.5 rounded-lg border p-3 bg-muted/20">
            <Label className="text-xs font-semibold">School Brand Color</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="color"
                className="w-10 h-8 p-0 cursor-pointer rounded border"
                value={s.theme_color || "#0a6d3b"}
                onChange={(e) => setF("theme_color", e.target.value)}
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { name: "Forest Green", hex: "#0a6d3b" },
                  { name: "Royal Blue", hex: "#1e40af" },
                  { name: "Burgundy", hex: "#831843" },
                  { name: "Deep Purple", hex: "#581c87" },
                  { name: "Navy Blue", hex: "#0f172a" },
                  { name: "Amber / Gold", hex: "#b45309" },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setF("theme_color", c.hex)}
                    className="h-7 px-2.5 rounded-md text-[11px] font-medium border text-white shadow-xs transition-transform hover:scale-105"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <Label>Logo</Label>
              {s.logo_url && <img src={s.logo_url} alt="" className="h-16 w-16 object-contain border rounded mb-2 bg-white" />}
              <Input type="file" accept="image/*" onChange={(e) => onFile("logo_url", "logo", e.target.files?.[0])} />
            </div>
            <div>
              <Label>Stamp</Label>
              {s.stamp_url && <img src={s.stamp_url} alt="" className="h-16 w-16 object-contain border rounded mb-2 bg-white" />}
              <Input type="file" accept="image/*" onChange={(e) => onFile("stamp_url", "stamp", e.target.files?.[0])} />
            </div>
            <div>
              <Label>Principal signature</Label>
              {s.principal_signature_url && <img src={s.principal_signature_url} alt="" className="h-16 object-contain border rounded mb-2 bg-white" />}
              <Input type="file" accept="image/*" onChange={(e) => onFile("principal_signature_url", "sign", e.target.files?.[0])} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Motto</Label><Input value={s.motto ?? ""} onChange={(e) => setF("motto", e.target.value)} /></div>
            <div><Label>Website</Label><Input value={s.website ?? ""} onChange={(e) => setF("website", e.target.value)} /></div>
            <div><Label>Branch name</Label><Input value={s.branch_name ?? ""} onChange={(e) => setF("branch_name", e.target.value)} /></div>
            <div><Label>Principal name</Label><Input value={s.principal_name ?? ""} onChange={(e) => setF("principal_name", e.target.value)} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={s.address ?? ""} onChange={(e) => setF("address", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={s.phone ?? ""} onChange={(e) => setF("phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={s.email ?? ""} onChange={(e) => setF("email", e.target.value)} /></div>
            <div><Label>Facebook</Label><Input value={s.facebook_url ?? ""} onChange={(e) => setF("facebook_url", e.target.value)} /></div>
            <div><Label>Instagram</Label><Input value={s.instagram_url ?? ""} onChange={(e) => setF("instagram_url", e.target.value)} /></div>
            <div><Label>X (Twitter)</Label><Input value={s.twitter_url ?? ""} onChange={(e) => setF("twitter_url", e.target.value)} /></div>
            <div><Label>Current session</Label><Input value={s.current_session ?? ""} onChange={(e) => setF("current_session", e.target.value)} /></div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
