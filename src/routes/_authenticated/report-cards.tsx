import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { getReportCardsList } from "@/lib/api/results.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/report-cards")({
  head: () => ({ meta: [{ title: "Report Cards — EduERP" }] }),
  component: ReportCardsListPage,
});

function ReportCardsListPage() {
  const { roles } = useAuth();
  const isStaff = hasRole(roles, "super_admin", "school_admin", "teacher");
  const loadCards = useServerFn(getReportCardsList);

  const { data: cards, isLoading } = useQuery({
    queryKey: ["report-cards-list"],
    queryFn: async () => {
      const data = await loadCards();
      return data.cards ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Cards</h1>
        <p className="text-sm text-muted-foreground">
          {isStaff ? "All published report cards. Click to view and print." : "Your published report cards."}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Available report cards</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : !cards?.length ? (
            <p className="text-muted-foreground text-sm">
              No report cards yet. Go to <Link to="/results" className="text-primary underline">Results</Link> and publish a class.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Avg</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.students?.first_name} {c.students?.last_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.students?.admission_no}</div>
                    </TableCell>
                    <TableCell>{c.classes?.name} {c.classes?.arm}</TableCell>
                    <TableCell>{c.session}</TableCell>
                    <TableCell className="capitalize">{c.term}</TableCell>
                    <TableCell>{c.average}%</TableCell>
                    <TableCell>{c.position} / {c.class_size}</TableCell>
                    <TableCell>
                      {c.published ? <Badge>Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/report-card/$id" params={{ id: c.id }}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
