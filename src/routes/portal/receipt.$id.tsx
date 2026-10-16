import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getReceipt } from "@/lib/api/portal.functions";
import { DigitalReceipt } from "@/components/finance/DigitalReceipt";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/portal/receipt/$id")({
  head: () => ({
    meta: [
      { title: "Official Payment Receipt — EduERP Parent Portal" },
      { name: "description", content: "Electronic verified school fee payment receipt with tamper-proof QR code." },
      { property: "og:title", content: "Official Payment Receipt — EduERP Parent Portal" },
      { property: "og:description", content: "Electronic verified school fee payment receipt with tamper-proof QR code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = useParams({ from: "/portal/receipt/$id" });
  const { token } = useParentAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["receipt", token, id],
    queryFn: () => getReceipt({ data: { token: token!, payment_id: id } }),
    enabled: !!token,
  });

  return (
    <div className="space-y-4 max-w-2xl mx-auto py-4">
      {/* Back button (hidden in print) */}
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
          <Link to="/portal/fees">
            <ArrowLeft className="h-4 w-4" />
            Back to Fees & Statements
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-sm text-muted-foreground bg-card rounded-xl border">
          <div className="animate-spin inline-block h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>Generating digital payment receipt…</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="p-8 text-center text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-semibold">Unable to load receipt</p>
          <p className="text-xs text-muted-foreground mt-1">{(error as any)?.message || "Receipt was not found or has expired."}</p>
        </div>
      )}

      {data && !isLoading && (
        <DigitalReceipt data={data as any} />
      )}
    </div>
  );
}
