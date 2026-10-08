import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setParentSession } from "@/hooks/useParentAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { GraduationCap, Phone } from "lucide-react";
import { startDemo } from "@/lib/api/demo.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — EduERP" }, { name: "description", content: "Sign in for authorized school accounts and families in EduERP." }, { property: "og:title", content: "Sign in — EduERP" }, { property: "og:description", content: "Sign in for authorized school accounts and families in EduERP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/dashboard", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back!");
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const code = schoolCode.trim().toUpperCase();
    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("id, name")
      .eq("code", code)
      .maybeSingle();
    if (schoolErr || !school) {
      setLoading(false);
      toast.error("Invalid school code. Please contact your school administrator.");
      return;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName, school_code: code, school_id: school.id },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    setLoading(false);
    toast.success(
      `Account created for ${school.name}. An administrator will assign your role.`,
    );
  };

  const parentLogin = async (e: React.FormEvent) => {
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
      setParentSession(json.token, json.parent);
      toast.success(`Welcome, ${json.parent.full_name}`);
      navigate({ to: "/portal" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-foreground">EduERP</span>
        </Link>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium">Just looking around?</p>
              <p className="mb-2 text-muted-foreground">Explore a demo school with students, results and fees already filled in.</p>
              <Button type="button" variant="secondary" className="w-full" disabled={loading} onClick={async () => {
                setLoading(true);
                try {
                  const c = await startDemo();
                  const { error } = await supabase.auth.signInWithPassword(c);
                  if (error) throw error;
                  toast.success("Welcome to the demo school!");
                } catch (e: any) { toast.error(e?.message ?? "Demo unavailable"); }
                setLoading(false);
              }}>{loading ? "Opening…" : "Try the demo school"}</Button>
              <p className="mt-2 text-xs text-muted-foreground">Parent demo: Parent tab, phone 08090000001</p>
            </div>
            <Tabs defaultValue="parent">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="parent"><Phone className="mr-1 h-3.5 w-3.5" />Parent</TabsTrigger>
                <TabsTrigger value="signin">Staff</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="parent">
                <form onSubmit={parentLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="parent_phone">Phone number</Label>
                    <Input id="parent_phone" type="tel" inputMode="tel" required placeholder="e.g. 08012345678"
                      value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      Use the phone number you gave the school when registering your child. No password needed.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Checking…" : "Enter portal"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school_code">School code</Label>
                    <Input
                      id="school_code"
                      required
                      placeholder="e.g. HGA-001"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Get this from your school administrator. Your role will be assigned after sign-up.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">Password</Label>
                    <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
