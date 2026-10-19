import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, X, Download, Camera, Sparkles, ShieldCheck, Lock } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { inviteStaff, removeStaffRole } from "@/lib/api/staff.functions";
import { PassportPhotoStudio } from "@/components/PassportPhotoStudio";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users & Roles — EduERP" }, { name: "description", content: "Users & Roles for authorized school accounts and families in EduERP." }, { property: "og:title", content: "Users & Roles — EduERP" }, { property: "og:description", content: "Users & Roles for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: UsersPage,
});

const STAFF_ROLES = ["school_admin", "teacher", "accountant"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function UsersPage() {
  const { roles: myRoles, schoolId: mySchoolId } = useAuth();
  const isSuper = hasRole(myRoles, "super_admin");
  const isSchoolAdmin = hasRole(myRoles, "school_admin");
  const canManage = isSuper || isSchoolAdmin;

  // Passport Photo Studio state for teachers/staff
  const [targetStaff, setTargetStaff] = useState<{ id: string; name: string; photo_url?: string | null; school_id?: string | null } | null>(null);

  // Super admins can assign any non-super role.
  // School admins can only assign teachers and accountants within their school.
  const assignableRoles: StaffRole[] = isSuper
    ? ["school_admin", "teacher", "accountant"]
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
    role: defaultRole,
    school_id: mySchoolId ?? "",
  });

  const exportStaffExcel = () => {
    if (!profiles?.length) return toast.error("No staff members to export");
    const headers = ["Full Name", "School", "Phone", "Assigned Roles", "User ID"];
    const rows = profiles.map((p) => {
      const uRoles = rowRoles(p.user_id).map((r) => r.role).join(", ");
      return [
        p.full_name ?? "—",
        schoolName(p.school_id),
        p.phone ?? "—",
        uRoles || "No role assigned",
        p.user_id,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 26 }, { wch: 38 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff_Directory");
    XLSX.writeFile(wb, `Staff_Roster_Bulk_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Bulk staff directory exported to Excel (.xlsx)");
  };

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: form }),
    onSuccess: () => {
      toast.success("Invitation sent");
      setOpen(false);
      setForm({ email: "", full_name: "", role: defaultRole, school_id: mySchoolId ?? "" });
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
          <h1 className="text-2xl font-bold tracking-tight">Staff & Teachers Directory</h1>
          <p className="text-sm text-muted-foreground">
            Manage teachers, staff, assigned roles, and official biometric passport photographs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportStaffExcel} className="text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Export Bulk (Excel)
          </Button>

          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Assign role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign a role</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => { e.preventDefault(); inviteMut.mutate(); }}
                  className="space-y-4"
                >
                  <p className="text-xs text-muted-foreground">
                    Enter the email of a staff member who has already registered at the sign-up page. If
                    they don't have an account yet, we'll send them an invitation email.
                  </p>
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
                          {assignableRoles.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r === "school_admin" ? "School Admin" : r === "teacher" ? "Teacher" : "Accountant"}
                            </SelectItem>
                          ))}
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
                  <DialogFooter>
                    <Button type="submit" disabled={inviteMut.isPending || !form.school_id}>
                      {inviteMut.isPending ? "Saving…" : "Assign role"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Permanent Staff Record Protection Notice */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/60 p-3 flex items-start gap-3 text-xs text-emerald-950">
        <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-bold text-emerald-900 block">
            Permanent Staff Records Protected
          </span>
          <p className="text-emerald-800/90 text-[11px] mt-0.5 leading-relaxed">
            Registered teachers, instructors, and administrative staff accounts cannot be deleted. Institutional audit trails, lesson records, and academic mark entries are permanently preserved.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Teachers & Staff</CardTitle>
          <CardDescription>
            View registered teachers, upload official passport photos with Gemini AI enhancement, and manage permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-16">Passport</TableHead>
              <TableHead>Teacher / Staff Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {profiles?.length ? profiles.map((p) => {
                const userRoles = rowRoles(p.user_id);
                const initials = (p.full_name || "ST")
                  .split(" ")
                  .map((w: string) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="relative group">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-xs font-bold text-primary border border-border">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{p.full_name ?? "—"}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{p.user_id.slice(0, 8)}…</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{schoolName(p.school_id)}</TableCell>
                    <TableCell>{p.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length ? userRoles.map((r) => {
                          const removable = canManage && r.role !== "super_admin" && r.school_id &&
                            (isSuper || (r.school_id === mySchoolId && r.role !== "school_admin"));
                          return (
                            <Badge key={r.id} variant="secondary" className="gap-1">
                              {r.role}
                              {removable && (
                                <Button
                                  variant="ghost" size="icon"
                                  className="hover:text-destructive"
                                  onClick={() => removeMut.mutate({
                                    user_id: r.user_id,
                                    role: r.role as StaffRole,
                                    school_id: r.school_id ?? "",
                                  })}
                                  aria-label="Remove role"
                                ><X className="h-3 w-3" /></Button>
                              )}
                            </Badge>
                          );
                        }) : <span className="text-muted-foreground text-sm">No role</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setTargetStaff({
                          id: p.user_id,
                          name: p.full_name || "Staff Member",
                          photo_url: p.avatar_url,
                          school_id: p.school_id || mySchoolId,
                        })}
                      >
                        <Sparkles className="mr-1 h-3.5 w-3.5 text-primary" />
                        Passport Photo
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No users yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Passport Photo Studio for Staff */}
      {targetStaff && (
        <PassportPhotoStudio
          open={Boolean(targetStaff)}
          onOpenChange={(op) => !op && setTargetStaff(null)}
          targetName={targetStaff.name}
          targetType="teacher"
          targetId={targetStaff.id}
          schoolId={targetStaff.school_id || mySchoolId || "00000000-0000-0000-0000-000000000001"}
          initialPhotoUrl={targetStaff.photo_url}
          onPhotoSaved={() => {
            qc.invalidateQueries({ queryKey: ["all-profiles"] });
            toast.success("Teacher passport photograph updated");
          }}
        />
      )}
    </div>
  );
}
