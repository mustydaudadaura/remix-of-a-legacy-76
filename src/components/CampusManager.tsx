import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function CampusManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const { data } = useQuery({
    queryKey: ["campuses", schoolId],
    queryFn: async () => (await supabase.from("campuses").select("*").eq("school_id", schoolId).order("name")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["campuses", schoolId] });
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("campuses").insert({ school_id: schoolId, name, address: address || null });
    if (error) return toast.error(error.message);
    setName(""); setAddress(""); toast.success("Campus added"); refresh();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input required placeholder="Campus name (e.g. Main Campus)" value={name} onChange={(e) => setName(e.target.value)} className="min-w-48 flex-1" />
        <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} className="min-w-48 flex-1" />
        <Button type="submit">Add campus</Button>
      </form>
      {data?.length ? data.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3">
          <div><p className="font-medium">{c.name}</p><p className="text-sm text-muted-foreground">{c.address ?? "—"}</p></div>
          <Switch checked={c.active} onCheckedChange={async (v) => { const { error } = await supabase.from("campuses").update({ active: v }).eq("id", c.id); if (error) toast.error(error.message); refresh(); }} />
        </div>
      )) : <p className="text-sm text-muted-foreground">No campuses yet. Single-site schools can skip this.</p>}
    </div>
  );
}
