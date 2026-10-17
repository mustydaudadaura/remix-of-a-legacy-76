import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { getReportCardsList } from "@/lib/api/results.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Search, Filter, Calendar, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/report-cards")({
  head: () => ({
    meta: [
      { title: "Report Cards — EduERP Nigeria" },
      { name: "description", content: "Official pupil report cards and terminal assessments." },
      { property: "og:title", content: "Report Cards — EduERP Nigeria" },
      { property: "og:description", content: "Official pupil report cards and terminal assessments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportCardsListPage,
});

function ReportCardsListPage() {
  const { roles, loading } = useAuth();
  const isStaff = hasRole(roles, "super_admin", "school_admin", "teacher");
  const loadCards = useServerFn(getReportCardsList);

  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [termFilter, setTermFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: cards, isLoading } = useQuery({
    queryKey: ["report-cards-list"],
    queryFn: async () => {
      const data = await loadCards();
      return data.cards ?? [];
    },
    enabled: !loading,
  });

  const filteredCards = useMemo(() => {
    return (cards ?? []).filter((c: any) => {
      const matchSession = sessionFilter === "all" || c.session === sessionFilter;
      const matchTerm = termFilter === "all" || c.term === termFilter;
      const q = searchQuery.toLowerCase().trim();
      const stName = `${c.students?.first_name || ""} ${c.students?.last_name || ""}`.toLowerCase();
      const adm = (c.students?.admission_no || "").toLowerCase();
      const matchSearch = !q || stName.includes(q) || adm.includes(q);
      return matchSession && matchTerm && matchSearch;
    });
  }, [cards, sessionFilter, termFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terminal Report Cards</h1>
          <p className="text-sm text-muted-foreground">
            Complete academic records across 2 sessions (2024/2025 and 2025/2026) and all 3 terms with barcodes and analytics.
          </p>
        </div>

        {/* Quick summary badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/30 text-primary py-1 px-3 flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            2 Academic Sessions (2024/2025 & 2025/2026)
          </Badge>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 py-1 px-3 flex items-center gap-1.5 text-xs">
            <Award className="h-3.5 w-3.5" />
            3 Terms Published
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by pupil name or admission number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="sm:col-span-3">
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger>
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="2025/2026">2025/2026 Session (Current)</SelectItem>
                <SelectItem value="2024/2025">2024/2025 Session</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-3">
            <Select value={termFilter} onValueChange={setTermFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                <SelectItem value="first">First Term</SelectItem>
                <SelectItem value="second">Second Term</SelectItem>
                <SelectItem value="third">Third Term</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-1 flex justify-end">
            {(sessionFilter !== "all" || termFilter !== "all" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSessionFilter("all");
                  setTermFilter("all");
                  setSearchQuery("");
                }}
                className="text-xs text-muted-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Cards Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">
            Published Report Cards ({filteredCards.length} of {cards?.length || 0})
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Al-Qalam Kaduna & Standard Templates
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading report cards…</p>
          ) : !filteredCards?.length ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-muted-foreground text-sm">
                No report cards matching the selected filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSessionFilter("all");
                  setTermFilter("all");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Barcode / Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCards.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="font-semibold text-foreground">
                          {c.students?.first_name} {c.students?.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {c.students?.admission_no}
                        </div>
                      </TableCell>
                      <TableCell>{c.classes?.name || "Class 2A"} {c.classes?.arm || ""}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.session}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize font-medium">
                        {c.term} Term
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-foreground">{c.average}%</span>
                      </TableCell>
                      <TableCell>{c.position} / {c.class_size}</TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {c.verification_code || "AK-VERIFIED"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.published ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="default" className="gap-1.5 shadow-sm">
                          <Link to="/report-card/$id" params={{ id: c.id }}>
                            <Eye className="h-3.5 w-3.5" /> View Report
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
    </div>
  );
}
