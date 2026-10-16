import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getReportCardsList } from "@/lib/api/results.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CreditCard, FileText, Send } from "lucide-react";
import { PinBatchManager } from "@/components/pins/PinBatchManager";

export const Route = createFileRoute("/_authenticated/report-cards")({
  head: () => ({
    meta: [
      { title: "Report Cards & Scratch-Cards — EduERP" },
      { name: "description", content: "Official Nigerian Termly Report Cards & Scratch-Card PIN Access Control." },
      { property: "og:title", content: "Report Cards & Scratch-Cards — EduERP" },
      { property: "og:description", content: "Manage published report cards and generate 12-digit result checker PINs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportCardsListPage,
});

function ReportCardsListPage() {
  const { roles, loading, schoolId } = useAuth();
  const isStaff = hasRole(roles, "super_admin", "school_admin", "teacher");
  const loadCards = useServerFn(getReportCardsList);
  const [activeTab, setActiveTab] = useState<string>("reports");

  const { data: cards, isLoading } = useQuery({
    queryKey: ["report-cards-list"],
    queryFn: async () => {
      const data = await loadCards();
      return data.cards ?? [];
    },
    enabled: !loading,
  });

  const { data: school } = useQuery({
    queryKey: ["active-school-pins", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("schools")
        .select("id, name, logo_url, current_session")
        .eq("id", schoolId!)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Cards &amp; Result Checker</h1>
          <p className="text-sm text-muted-foreground">
            {isStaff
              ? "Manage student report cards, view broadsheet outputs, and issue scratch-card PIN tokens."
              : "Your official termly report cards."}
          </p>
        </div>

        {isStaff && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/results">
                <Send className="mr-1.5 h-3.5 w-3.5" /> Results Entry
              </Link>
            </Button>
          </div>
        )}
      </div>

      {isStaff ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              Published Report Cards ({cards?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="pins" className="gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Scratch-Card PIN Center
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <Card className="border shadow-sm">
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-base">Available Report Cards</CardTitle>
                <CardDescription className="text-xs">
                  All generated termly report cards. Click "View" to open the printable sheet or save as PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <p className="text-muted-foreground text-sm p-6">Loading report cards…</p>
                ) : !cards?.length ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No report cards published yet. Go to{" "}
                    <Link to="/results" className="text-primary underline font-medium">
                      Results Entry
                    </Link>{" "}
                    and publish a class.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Session</TableHead>
                          <TableHead>Term</TableHead>
                          <TableHead>Avg</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cards.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="font-medium">
                                {c.students?.first_name} {c.students?.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {c.students?.admission_no}
                              </div>
                            </TableCell>
                            <TableCell>
                              {c.classes?.name} {c.classes?.arm}
                            </TableCell>
                            <TableCell>{c.session}</TableCell>
                            <TableCell className="capitalize">{c.term}</TableCell>
                            <TableCell className="font-semibold">{c.average}%</TableCell>
                            <TableCell>
                              {c.position} / {c.class_size}
                            </TableCell>
                            <TableCell>
                              {c.published ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">Published</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                                <Link to="/report-card/$id" params={{ id: c.id }}>
                                  <Eye className="mr-1 h-3.5 w-3.5" /> View Card
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pins">
            <PinBatchManager
              schoolId={schoolId || "22222222-2222-2222-2222-222222222222"}
              schoolName={school?.name || "Result Arena Academy"}
              logoUrl={school?.logo_url}
              currentSession={school?.current_session || "2025/2026"}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Your Report Cards</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : !cards?.length ? (
              <p className="text-muted-foreground text-sm">No report cards available.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Avg</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.session}</TableCell>
                      <TableCell className="capitalize">{c.term}</TableCell>
                      <TableCell>{c.average}%</TableCell>
                      <TableCell>{c.position} / {c.class_size}</TableCell>
                      <TableCell className="text-right">
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
      )}
    </div>
  );
}
