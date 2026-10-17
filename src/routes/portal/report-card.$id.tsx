import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getPortalReportCardDetail } from "@/lib/api/portal.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { ReportCardView } from "@/components/ReportCardView";

export const Route = createFileRoute("/portal/report-card/$id")({
  head: () => ({ meta: [{ title: "Child Report Card — Alegace Parent Portal" }, { name: "description", content: "Child Report Card for authorized school accounts and families in Alegace." }, { property: "og:title", content: "Child Report Card — Alegace Parent Portal" }, { property: "og:description", content: "Child Report Card for authorized school accounts and families in Alegace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { token } = useParentAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-rc-detail", token, id],
    queryFn: () => getPortalReportCardDetail({ data: { token: token!, id } }),
    enabled: !!token,
  });

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Loading report card…</div>;
  if (error || !data?.rc) return <div className="p-6 text-destructive text-sm">Report card not available.</div>;

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="print:hidden sticky top-0 z-10 border-b bg-card px-4 py-3 flex items-center justify-between">
        <Link to="/portal/report-cards" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Link>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
      </div>
      <ReportCardView rc={data.rc} assessments={data.assessments as any} />
    </div>
  );
}
