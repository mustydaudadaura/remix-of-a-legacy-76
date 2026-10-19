import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDatabaseSchemaDiagnostics } from "@/lib/api/schema-diagnostics.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Sparkles,
  BookOpen,
  RefreshCw,
  Cpu,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/diagnostics")({
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedTable, setExpandedTable] = useState<string | null>("subjects");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["database-schema-diagnostics"],
    queryFn: () => getDatabaseSchemaDiagnostics(),
  });

  const tables = data?.tables ?? [];
  const filteredTables = tables.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.columns.some((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === "all" || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Database & AI Diagnostics Utility</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time introspection of active Supabase tables, column schemas, subject relationships, and AI model health.
          </p>
        </div>

        <Button
          onClick={() => refetch()}
          variant="outline"
          disabled={isFetching}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Run Diagnostic Scan
        </Button>
      </div>

      {/* Feature Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Subject Selection Health */}
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-emerald-600" /> Subject Selection
              </span>
              <Badge
                className={
                  data?.keyFeaturesHealth.subjectSelection.status === "healthy"
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                    : "bg-amber-500/10 text-amber-700 border-amber-300"
                }
                variant="outline"
              >
                {data?.keyFeaturesHealth.subjectSelection.status === "healthy" ? (
                  <CheckCircle2 className="h-3 w-3 mr-1 inline text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-3 w-3 mr-1 inline text-amber-600" />
                )}
                {data?.keyFeaturesHealth.subjectSelection.status ?? "checking..."}
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold">
              {data?.keyFeaturesHealth.subjectSelection.totalSubjects ?? 0} Core Subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between py-1 border-b">
              <span>School-Wide (Unbound):</span>
              <span className="font-semibold text-foreground">
                {data?.keyFeaturesHealth.subjectSelection.schoolWideSubjects ?? 0}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span>Class-Allocated:</span>
              <span className="font-semibold text-foreground">
                {data?.keyFeaturesHealth.subjectSelection.subjectsWithClassBinding ?? 0}
              </span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] pt-1 text-emerald-800 dark:text-emerald-300">
              {data?.keyFeaturesHealth.subjectSelection.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* AI Lesson Notes Health */}
        <Card className="relative overflow-hidden border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600" /> AI Lesson Notes
              </span>
              <Badge
                className={
                  data?.keyFeaturesHealth.aiLessonNotes.status === "healthy"
                    ? "bg-indigo-500/10 text-indigo-700 border-indigo-300"
                    : "bg-rose-500/10 text-rose-700 border-rose-300"
                }
                variant="outline"
              >
                {data?.keyFeaturesHealth.aiLessonNotes.status === "healthy" ? (
                  <CheckCircle2 className="h-3 w-3 mr-1 inline text-indigo-600" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1 inline text-rose-600" />
                )}
                {data?.keyFeaturesHealth.aiLessonNotes.status ?? "checking..."}
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold">
              {data?.aiConfiguration.model ?? "gemini-3.5-flash-lite"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between py-1 border-b">
              <span>Google Gemini API:</span>
              <span className="font-semibold text-foreground">
                {data?.aiConfiguration.geminiConfigured ? "Connected" : "Inactive"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span>NERDC Schema Validator:</span>
              <span className="font-semibold text-foreground">Active (JSON-mode)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] pt-1 text-indigo-800 dark:text-indigo-300">
              {data?.keyFeaturesHealth.aiLessonNotes.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Total Tables & Database Engine */}
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-amber-600" /> Database Schema
              </span>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300">
                PostgreSQL RLS
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold">
              {data?.totalTables ?? 0} Tables Defined
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between py-1 border-b">
              <span>Diagnostic Timestamp:</span>
              <span className="font-mono text-[11px] text-foreground">
                {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "—"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span>Curriculum Assistant AI:</span>
              <span className="font-semibold text-foreground">
                {data?.keyFeaturesHealth.aiCurriculumAssistant.status === "healthy"
                  ? "Operational"
                  : "Unavailable"}
              </span>
            </div>
            <p className="text-[11px] pt-1 text-muted-foreground">
              Every table is school-scoped with Row Level Security (RLS) policies and append-only audit triggers.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schema Browser Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" /> Active Table Definitions & Column Mappings
              </CardTitle>
              <CardDescription>
                Click any table row to expand its exact column types, nullability constraints, and verification status.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter table or column..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {[
              { id: "all", label: "All Tables" },
              { id: "core", label: "Core / Auth" },
              { id: "academics", label: "Academics" },
              { id: "assessments", label: "Assessments & Results" },
              { id: "finance", label: "Fees & Payroll" },
              { id: "staff", label: "Staff & Attendance" },
              { id: "portal", label: "Parents & Students" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Scanning Supabase schema metadata and verifying fields...
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No tables matched your filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTables.map((table) => {
                const isExpanded = expandedTable === table.name;
                return (
                  <div
                    key={table.name}
                    className="border rounded-lg overflow-hidden transition-all bg-card hover:border-primary/40"
                  >
                    <div
                      onClick={() => setExpandedTable(isExpanded ? null : table.name)}
                      className="p-3.5 flex items-center justify-between cursor-pointer select-none bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <span className="font-mono text-sm font-bold text-foreground">
                            {table.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({table.columns.length} columns)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-[11px]">
                          {table.category}
                        </Badge>
                        {table.sampleCount !== undefined && (
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-mono bg-background"
                          >
                            {table.sampleCount} rows
                          </Badge>
                        )}
                        {table.status === "verified" ? (
                          <Badge className="bg-emerald-600/10 text-emerald-700 border border-emerald-300 text-[11px]">
                            Healthy
                          </Badge>
                        ) : table.status === "empty" ? (
                          <Badge variant="outline" className="text-muted-foreground text-[11px]">
                            Empty
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[11px]">
                            Error
                          </Badge>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t bg-background">
                        {table.error && (
                          <div className="mb-3 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>Database warning: {table.error}</span>
                          </div>
                        )}

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-1/3">Column Name</TableHead>
                              <TableHead className="w-1/3">Type Definition</TableHead>
                              <TableHead className="w-1/3">Nullability</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {table.columns.map((col) => (
                              <TableRow key={col.name}>
                                <TableCell className="font-mono text-xs font-semibold text-foreground">
                                  {col.name}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {col.type}
                                </TableCell>
                                <TableCell>
                                  {col.isNullable ? (
                                    <span className="text-xs text-muted-foreground">Nullable</span>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] font-semibold">
                                      Required (NOT NULL)
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
