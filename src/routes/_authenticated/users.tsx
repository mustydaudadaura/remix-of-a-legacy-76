import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { inviteStaff, removeStaffRole } from "@/lib/api/staff.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users & Roles — EduERP" }] }),
  component: UsersPage,
});

const STAFF_ROLES = ["school_admin", "teacher", "accountant"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function UsersPage() {
  const { roles: myRoles, schoolId: mySchoolId } = useAuth();
  const isSuper = hasRole(myRoles, "super_admin");
  const isSchoolAdmin = hasRole(myRoles, "school_admin");
  const canManage = isSuper || isSchoolAdmin;

  // Super admins only assign school administrators.
  // School admins only assign teachers and accountants (not more school admins).
  const assignableRoles: StaffRole[] = isSuper
    ? ["school_admin"]
    : isSchoolAdmin
      ? ["teacher", "accountant"]
      : [];
  const defaultRole: StaffRole = assignableRoles[0] ?? "teacher";

  const qc = useQueryClient();
  const invite = useServerFn(inviteStaff);
  const removeRole = useServerFn(removeStaffRole);

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const { data: schools } = useQuery({
    queryKey: ["schools-min"],
    queryFn: async () => (await supabase.from("schools").select("id, name").order("name")).data ?? [],
  });

  const schoolName = (id: string | null) => schools?.find((s) => s.id === id)?.name ?? "—";
  const rowRoles = (uid: string) => roles?.filter((r) => r.user_id === uid) ?? [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "teacher" as StaffRole,
    school_id: mySchoolId ?? "",
  });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: form }),
    onSuccess: () => {
      toast.success("Invitation sent");
      setOpen(false);
      setForm({ email: "", full_name: "", role: "teacher", school_id: mySchoolId ?? "" });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (p: { user_id: string; role: StaffRole; school_id: string }) => removeRole({ data: p }),
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">Invite school staff and manage their access.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Invite staff</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite school staff</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); inviteMut.mutate(); }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" required value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="school_admin">School Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>School</Label>
                    <Select
                      value={form.school_id}
                      onValueChange={(v) => setForm({ ...form, school_id: v })}
                      disabled={!isSuper && !!mySchoolId}
                    >
                      <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                      <SelectContent>
                        {schools?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  An invitation email will be sent. They'll set their password on first sign-in.
                </p>
                <DialogFooter>
                  <Button type="submit" disabled={inviteMut.isPending || !form.school_id}>
                    {inviteMut.isPending ? "Sending…" : "Send invitation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>All users</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {profiles?.length ? profiles.map((p) => {
                const userRoles = rowRoles(p.user_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{schoolName(p.school_id)}</TableCell>
                    <TableCell>{p.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length ? userRoles.map((r) => {
                          const removable = canManage && r.role !== "super_admin" && r.school_id &&
                            (isSuper || r.school_id === mySchoolId);
                          return (
                            <Badge key={r.id} variant="secondary" className="gap-1">
                              {r.role}
                              {removable && (
                                <button
                                  type="button"
                                  className="hover:text-destructive"
                                  onClick={() => removeMut.mutate({
                                    user_id: r.user_id,
                                    role: r.role as StaffRole,
                                    school_id: r.school_id!,
                                  })}
                                  aria-label="Remove role"
                                ><X className="h-3 w-3" /></button>
                              )}
                            </Badge>
                          );
                        }) : <span className="text-muted-foreground text-sm">No role</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No users yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
