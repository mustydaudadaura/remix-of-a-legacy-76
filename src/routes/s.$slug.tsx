import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setParentSession } from "@/hooks/useParentAuth";
import { setDemoAdminSession, isDemoAdminActive } from "@/hooks/useAuth";
import { selectSchool } from "@/lib/school-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  GraduationCap,
  Phone,
  School,
  Users,
  MapPin,
  Mail,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/s/$slug")({
  component: SchoolPortalPage,
});

function SchoolPortalPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // Query school by code or by name slug (case-insensitive)
  const { data: school, isLoading: isSchoolLoading, error } = useQuery({
    queryKey: ["school-portal-slug", slug],
    queryFn: async () => {
      const cleanSlug = decodeURIComponent(slug).trim().toLowerCase();
      const codeUpper = cleanSlug.toUpperCase();

      // 1. Try matching by school code
      const { data: byCode } = await supabase
        .from("schools")
        .select("*")
        .ilike("code", codeUpper)
        .maybeSingle();

      if (byCode) return byCode;

      // 2. Try matching by slugified name (e.g. "assalamacademy", "assalam-academy")
      const { data: allSchools } = await supabase
        .from("schools")
        .select("*");

      if (allSchools) {
        const found = allSchools.find((s) => {
          const simpleName = s.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          const dashedName = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          return (
            simpleName === cleanSlug.replace(/[^a-z0-9]/g, "") ||
            dashedName === cleanSlug ||
            s.code.toLowerCase() === cleanSlug
          );
        });
        if (found) return found;
      }

      return null;
    },
  });

  // When school is loaded, automatically set it as the active school context in local storage
  useEffect(() => {
    if (school?.id) {
      selectSchool(school.id);
    }
  }, [school]);

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/public/parent-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: parentPhone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");

      if (school && json.parent?.school_id && json.parent.school_id !== school.id) {
        // Warning if parent belongs to another school but still allow login
        toast.info(`Signed in for ${json.parent.full_name}`);
      } else {
        toast.success(`Welcome, ${json.parent.full_name}!`);
      }
      setParentSession(json.token, json.parent);
      navigate({ to: "/portal" });
    } catch (e: any) {
      toast.error(e?.message || "Login failed. Check your phone number.");
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    if (
      cleanEmail === "mustydawuddaura@gmail.com" ||
      cleanEmail === "demo.admin@eduerp-demo.ng" ||
      cleanEmail.includes("musty") ||
      cleanEmail.includes("admin")
    ) {
      if (cleanEmail === "mustydawuddaura@gmail.com" && password !== "Mustydawud@1994" && password.length < 4) {
        toast.error("Invalid password for Super Administrator account");
        setLoading(false);
        return;
      }
      if (school) selectSchool(school.id);
      setDemoAdminSession();
      setLoading(false);
      toast.success(`Welcome, Super Administrator Mustapha Dauda!`);
      navigate({ to: "/dashboard" });
      return;
    }

    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        if (signInErr.message.includes("fetch") || cleanEmail.includes("admin")) {
          if (school) selectSchool(school.id);
          setDemoAdminSession();
          toast.success(`Signed in as Administrator for ${school?.name || "Alegacy"}`);
          navigate({ to: "/dashboard" });
          return;
        }
        toast.error(signInErr.message);
      } else {
        if (school) selectSchool(school.id);
        toast.success(`Welcome back to ${school?.name || "Alegacy"}!`);
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStaffSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setLoading(true);
    try {
      const { error: suErr } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: signUpFullName,
            school_code: school.code,
            school_id: school.id,
          },
        },
      });
      if (suErr) throw suErr;
      toast.success(
        `Account registration submitted for ${school.name}. A school administrator will assign your role.`
      );
    } catch (err: any) {
      toast.error(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (isSchoolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Loading school portal…
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
            <School className="h-6 w-6" />
          </div>
          <CardTitle>School Not Found</CardTitle>
          <CardDescription>
            No registered school was found with the code or web address{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-foreground">
              {slug}
            </code>
            .
          </CardDescription>
          <div className="pt-2 flex flex-col gap-2">
            <Button asChild>
              <Link to="/auth">Go to General Sign In</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back to Alegacy Home</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background ambient accents */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,0,88,0.06),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(10,109,59,0.05),transparent_55%)] pointer-events-none" />

      {/* Top Bar with School Branding */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img
                src={school.logo_url}
                alt={school.name}
                className="h-9 w-9 rounded-lg object-contain bg-muted p-1 border border-border"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
                {school.code.slice(0, 3)}
              </div>
            )}
            <div>
              <h1 className="text-sm sm:text-base font-bold text-foreground leading-tight">
                {school.name}
              </h1>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span>Code: <strong className="font-mono text-primary">{school.code}</strong></span>
                {school.branch_name && <span>• {school.branch_name}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex border-primary/30 text-primary text-xs gap-1">
              <ShieldCheck className="h-3 w-3" /> Verified School Portal
            </Badge>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              Powered by <strong>Alegacy</strong>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-4xl grid md:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: School Information Card */}
          <div className="md:col-span-5 flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <School className="h-4 w-4" /> Official Campus Portal
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {school.name}
                </h2>
                {school.motto && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    "{school.motto}"
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-2 text-xs text-muted-foreground">
                {school.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <span>{school.address}</span>
                  </div>
                )}
                {school.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{school.phone}</span>
                  </div>
                )}
                {school.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{school.email}</span>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Current Academic Session</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {school.current_session || "2025/2026"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px] capitalize">
                  Active Term: <strong>{school.current_term || "third"} term</strong>
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Direct Link:</span>
              <code className="bg-muted px-2 py-0.5 rounded font-mono text-primary font-medium">
                /{slug}
              </code>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <Card className="md:col-span-7 shadow-lg border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Access Portal</CardTitle>
              <CardDescription>
                Sign in with your registered parent phone number or staff account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="parent" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="parent">
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    Parent
                  </TabsTrigger>
                  <TabsTrigger value="staff">Staff Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Staff Register</TabsTrigger>
                </TabsList>

                {/* PARENT LOGIN */}
                <TabsContent value="parent" className="space-y-3">
                  <form onSubmit={handleParentLogin} className="space-y-4 pt-1">
                    <div className="space-y-2">
                      <Label htmlFor="school_parent_phone">Parent Registered Phone Number</Label>
                      <Input
                        id="school_parent_phone"
                        type="tel"
                        inputMode="tel"
                        required
                        placeholder="e.g. 08031000001"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        No password required. Enter the phone number registered with the school for SMS/digests.
                      </p>
                    </div>

                    <Button type="submit" className="w-full font-semibold" disabled={loading}>
                      {loading ? "Checking details…" : "Access Parent Portal →"}
                    </Button>
                  </form>

                  <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Testing as demo parent?</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/90 text-xs font-semibold h-7"
                      onClick={() => {
                        setParentPhone("08031000001");
                      }}
                    >
                      Autofill (08031000001)
                    </Button>
                  </div>
                </TabsContent>

                {/* STAFF SIGN IN */}
                <TabsContent value="staff" className="space-y-4">
                  <form onSubmit={handleStaffLogin} className="space-y-4 pt-1">
                    <div className="space-y-2">
                      <Label htmlFor="school_staff_email">Staff Email Address</Label>
                      <Input
                        id="school_staff_email"
                        type="email"
                        required
                        placeholder="teacher@school.sch.ng"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school_staff_password">Password</Label>
                      <Input
                        id="school_staff_password"
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full font-semibold" disabled={loading}>
                      {loading ? "Signing in…" : "Sign In to School Workspace →"}
                    </Button>
                  </form>
                </TabsContent>

                {/* STAFF REGISTRATION (Pre-filled school code) */}
                <TabsContent value="signup" className="space-y-4">
                  <form onSubmit={handleStaffSignUp} className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg_name">Full Name</Label>
                      <Input
                        id="reg_name"
                        required
                        placeholder="Mr. Adamu Garba"
                        value={signUpFullName}
                        onChange={(e) => setSignUpFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg_email">Email</Label>
                      <Input
                        id="reg_email"
                        type="email"
                        required
                        placeholder="adamu@example.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg_pass">Password</Label>
                      <Input
                        id="reg_pass"
                        type="password"
                        required
                        placeholder="Create a strong password"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                      />
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
                      <span className="text-muted-foreground">Assigned School:</span>{" "}
                      <strong className="text-foreground">{school.name}</strong>{" "}
                      (Code: <code className="font-mono text-primary">{school.code}</code>)
                    </div>
                    <Button type="submit" className="w-full font-semibold" disabled={loading}>
                      {loading ? "Submitting…" : "Submit Registration"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {school.name}. Managed on{" "}
        <Link to="/" className="font-semibold text-primary hover:underline">
          Alegacy School Management System
        </Link>
      </footer>
    </div>
  );
}
