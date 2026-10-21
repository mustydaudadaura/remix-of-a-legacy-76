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
import { UserPlus, Download, Printer, Camera, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { inviteStaff } from "@/lib/api/staff.functions";
import { PassportPhotoStudioModal } from "@/components/admissions/PassportPhotoStudioModal";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users & Roles — EduERP" }, { name: "description", content: "Staff registry, roles and official photograph management in EduERP." }, { property: "og:title", content: "Users & Roles — EduERP" }, { property: "og:description", content: "Staff registry, roles and official photograph management in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: UsersPage,
});

const STAFF_ROLES = ["school_admin", "teacher", "accountant"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function UsersPage() {
  const { roles: myRoles, schoolId: mySchoolId } = useAuth();
  const isSuper = hasRole(myRoles, "super_admin");
  const isSchoolAdmin = hasRole(myRoles, "school_admin");
  const canManage = isSuper || isSchoolAdmin;

  const assignableRoles: StaffRole[] = isSuper
    ? ["school_admin", "teacher", "accountant"]
    : isSchoolAdmin
      ? ["teacher", "accountant"]
      : [];
  const defaultRole: StaffRole = assignableRoles[0] ?? "teacher";

  const qc = useQueryClient();
  const invite = useServerFn(inviteStaff);

  const { data: profiles, isLoading } = useQuery({
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
  const [passportTarget, setPassportTarget] = useState<any | null>(null);

  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: defaultRole,
    school_id: mySchoolId ?? "",
    password: "",
  });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email: form.email, full_name: form.full_name, role: form.role, school_id: form.school_id, password: form.password.trim() || undefined } }),
    onSuccess: () => {
      toast.success(form.password ? "Staff saved. They can now sign in with the email and temporary password." : "Staff role assigned.");
      setOpen(false);
      setForm({ email: "", full_name: "", role: defaultRole, school_id: mySchoolId ?? "", password: "" });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk Export to CSV
  const exportBulkCSV = () => {
    if (!profiles?.length) {
      toast.error("No staff members to export");
      return;
    }
    const headers = ["Full Name", "School", "Phone", "Assigned Roles", "Registered Date"];
    const rows = profiles.map((p) => {
      const uRoles = rowRoles(p.user_id).map((r) => r.role).join("; ") || "No role";
      return [
        `"${(p.full_name || "").replace(/"/g, '""')}"`,
        `"${(schoolName(p.school_id) || "").replace(/"/g, '""')}"`,
        `"${(p.phone || "").replace(/"/g, '""')}"`,
        `"${uRoles.replace(/"/g, '""')}"`,
        `"${new Date(p.created_at).toLocaleDateString("en-GB")}"`,
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `registered_staff_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${profiles.length} staff records to CSV!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff & Teacher Registry</h1>
          <p className="text-sm text-muted-foreground">
            Manage teacher records, roles, and biometric photograph standards.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="text-xs font-semibold gap-1.5 shadow-2xs border-primary/40 hover:bg-primary/10"
            onClick={exportBulkCSV}
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            Export Bulk (CSV)
          </Button>

          <Button
            type="button"
            variant="outline"
            className="text-xs font-semibold gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            Print Staff Directory
          </Button>

          {canManage && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm((f) => ({ ...f, school_id: f.school_id || mySchoolId || "", role: assignableRoles.includes(f.role) ? f.role : defaultRole })); }}>
              <DialogTrigger asChild>
                <Button className="text-xs font-semibold">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register Staff / Assign Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register Staff Account</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    inviteMut.mutate();
                  }}
                  className="space-y-4"
                >
                  <p className="text-xs text-muted-foreground">
                    Enter the staff member details. Once registered, their record is permanently linked to the school.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temp_password">Temporary password (for new accounts)</Label>
                    <Input
                      id="temp_password"
                      type="text"
                      minLength={8}
                      placeholder="At least 8 characters — share it with the staff member"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty if the person already has an account.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={form.role}
                        onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r === "school_admin"
                                ? "School Admin"
                                : r === "teacher"
                                ? "Teacher"
                                : "Accountant"}
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select school" />
                        </SelectTrigger>
                        <SelectContent>
                          {schools?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={inviteMut.isPending || !form.school_id}>
                      {inviteMut.isPending ? "Saving…" : "Save Staff"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Retention Policy Banner */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
        <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0" />
        <div>
          <span className="font-semibold">Permanent Record Protection: </span>
          Registered teachers, staff accounts, and school assignments are permanently preserved to safeguard academic history, credentials, and institutional compliance. Deletion features are restricted.
        </div>
      </div>

      {/* Staff Directory Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Staff & Teacher Profiles</CardTitle>
              <CardDescription>
                Click "Passport Photo" to upload or enhance official photograph with Gemini (100% face preserved).
              </CardDescription>
            </div>
            {profiles && (
              <div className="text-xs text-muted-foreground font-mono">
                {profiles.length} registered staff
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-16">Photo</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Photograph Studio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading staff directory…
                  </TableCell>
                </TableRow>
              ) : profiles?.length ? (
                profiles.map((p) => {
                  const userRoles = rowRoles(p.user_id);
                  const initials = (p.full_name || "Staff")
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <div className="h-10 w-10 rounded-full border border-primary/30 overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div>{p.full_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">ID: {p.user_id?.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{schoolName(p.school_id)}</TableCell>
                      <TableCell className="text-sm">{p.phone ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userRoles.length ? (
                            userRoles.map((r) => (
                              <Badge key={r.id} variant="secondary" className="capitalize">
                                {r.role.replace("_", " ")}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Staff</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPassportTarget(p)}
                          className="text-xs h-7 gap-1"
                        >
                          <Camera className="h-3 w-3 text-primary" />
                          <span>Passport (Gemini)</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No registered staff found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Staff Passport Photo Modal */}
      {passportTarget && (
        <PassportPhotoStudioModal
          open={!!passportTarget}
          onOpenChange={(isOpen) => !isOpen && setPassportTarget(null)}
          personName={passportTarget.full_name || "Staff Member"}
          personIdentifier={passportTarget.phone || passportTarget.user_id?.slice(0, 8)}
          currentPhotoUrl={passportTarget.avatar_url}
          role="teacher"
          onSavePhoto={async (dataUrl) => {
            const { error } = await supabase
              .from("profiles")
              .update({ avatar_url: dataUrl })
              .eq("id", passportTarget.id);
            if (error) {
              toast.error(error.message);
            } else {
              toast.success(`Passport photo saved for ${passportTarget.full_name}! 100% Face Preserved.`);
              qc.invalidateQueries({ queryKey: ["all-profiles"] });
              setPassportTarget(null);
            }
          }}
        />
      )}
    </div>
  );
}
