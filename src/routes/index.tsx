import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, FileText, Shield, BarChart3, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { title: "EduERP — Nigeria's Modern School Management Platform" },
      { name: "description", content: "All-in-one ERP for Nigerian schools: admissions, results, report cards, fees, and parent portal." },
      { property: "og:title", content: "EduERP — Modern School Management" },
      { property: "og:description", content: "All-in-one ERP for Nigerian schools." },
    ],
  }),
  component: Landing,
});

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">EduERP</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Get Started</Button></Link>
          </nav>
        </div>
      </header>

      <section
        className="relative overflow-hidden text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              Built for Nigerian schools
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              The complete school management platform
            </h1>
            <p className="mt-5 max-w-2xl text-base text-primary-foreground/85 md:text-lg">
              Admissions, classes, CA &amp; exam results, automatic WAEC grading, report card
              PDFs, parent portal, fees — all in one secure, cloud-based system.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="font-semibold">
                  Start free trial
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  See features
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Everything your school needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            Designed for primary, secondary, and tertiary institutions across Nigeria.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={Users} title="Student & Parent Management" desc="Admissions, profiles, automatic parent linking, and class assignments." />
          <Feature icon={FileText} title="Results & Report Cards" desc="CA1, CA2, exam scoring with automatic WAEC grading and printable PDF report cards." />
          <Feature icon={BookOpen} title="Classes & Subjects" desc="Manage JSS1–SS3, primary, and tertiary classes with subject allocations." />
          <Feature icon={BarChart3} title="Analytics Dashboard" desc="Track performance, attendance, and school-wide KPIs in real time." />
          <Feature icon={Shield} title="Role-based Security" desc="Super Admin, School Admin, Teacher, Student, Parent, Accountant — each with proper access." />
          <Feature icon={GraduationCap} title="Multi-school Ready" desc="One platform, many schools. Built for SaaS scale." />
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} EduERP. All rights reserved.</p>
          <Link to="/auth" className="text-sm font-medium text-primary hover:underline">
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
}
