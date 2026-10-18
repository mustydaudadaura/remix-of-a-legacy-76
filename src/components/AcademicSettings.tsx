import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GraduationCap,
  Scale,
  Save,
  RotateCcw,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  CA_RATIOS,
  WAEC_9POINT_SCALE,
  PRIMARY_5POINT_SCALE,
  resolveSchoolAcademicConfig,
  type SchoolAcademicConfig,
  type CaRatioType,
  type GradingScaleType,
  type PromotionWeighting,
} from "@/lib/grading";

interface AcademicSettingsProps {
  school: {
    id: string;
    name: string;
    report_template?: unknown;
    [key: string]: any;
  };
}

export function AcademicSettings({ school }: AcademicSettingsProps) {
  const qc = useQueryClient();
  const initialConfig = resolveSchoolAcademicConfig(school.report_template);

  const [config, setConfig] = useState<SchoolAcademicConfig>(initialConfig);
  const [busy, setBusy] = useState(false);
  const [activePreviewScale, setActivePreviewScale] = useState<"secondary" | "primary">("secondary");

  const handleSave = async () => {
    setBusy(true);
    try {
      const currentTemplate =
        typeof school.report_template === "object" && school.report_template !== null
          ? (school.report_template as Record<string, any>)
          : {};

      const updatedTemplate = {
        ...currentTemplate,
        academic_config: config,
      };

      const { error } = await supabase
        .from("schools")
        .update({ report_template: updatedTemplate as any })
        .eq("id", school.id);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["school-settings", school.id] });
      await qc.invalidateQueries({ queryKey: ["schools"] });
      await qc.invalidateQueries({ queryKey: ["report-cards"] });
      await qc.invalidateQueries({ queryKey: ["assessments"] });

      toast.success("Nigerian Academic & Grading standards saved successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save academic settings");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setConfig(resolveSchoolAcademicConfig(null));
    toast.info("Reset to Nigerian national standards.");
  };

  const activeRatio = CA_RATIOS[config.caRatio] || CA_RATIOS["20_20_60"];
  const previewScaleList =
    activePreviewScale === "secondary" ? WAEC_9POINT_SCALE : PRIMARY_5POINT_SCALE;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Academic Evaluation & Nigerian National Grading
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    WAEC / NECO / BECE
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configure Continuous Assessment (CA) vs. Exam weight ratios, 9-point WAEC grading, and 3-term promotion rules.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={busy}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Defaults
              </Button>
              <Button size="sm" onClick={handleSave} disabled={busy} className="font-medium">
                <Save className="h-3.5 w-3.5 mr-1" />
                {busy ? "Saving…" : "Save Academic Settings"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          {/* Section 1: Continuous Assessment (CA) vs Exam Ratio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  Continuous Assessment (CA) vs. Exam Ratio
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Determines score entry fields and maximum mark caps on teacher scoresheets and report cards.
                </p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                Total: 100 Marks
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(CA_RATIOS) as CaRatioType[]).map((key) => {
                const r = CA_RATIOS[key];
                const selected = config.caRatio === key;
                return (
                  <div
                    key={key}
                    onClick={() => setConfig({ ...config, caRatio: key })}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                        : "border-border bg-card hover:bg-muted/50 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{r.label}</span>
                      {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {r.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-muted border">
                        {r.ca1Label}: {r.ca1Max}
                      </span>
                      {r.ca2Max > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-muted border">
                          {r.ca2Label}: {r.ca2Max}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-muted border">
                        {r.examLabel}: {r.examMax}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Grading Scales Configuration */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  National Grading Scales (WAEC & Basic Education)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Applied to continuous assessments, terminal examinations, and official report cards.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                <Button
                  size="sm"
                  variant={activePreviewScale === "secondary" ? "default" : "ghost"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setActivePreviewScale("secondary")}
                >
                  Secondary (WAEC/NECO 9-Pt)
                </Button>
                <Button
                  size="sm"
                  variant={activePreviewScale === "primary" ? "default" : "ghost"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setActivePreviewScale("primary")}
                >
                  Primary / Basic (5-Pt)
                </Button>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-20">Grade</TableHead>
                    <TableHead>Score Range</TableHead>
                    <TableHead>National Remark</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead className="text-right">Grade Point (GPA)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewScaleList.map((g) => (
                    <TableRow key={g.grade}>
                      <TableCell className="font-bold font-mono text-sm">
                        <span
                          className={`inline-block px-2 py-0.5 rounded ${
                            g.isCredit
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold"
                              : g.isPass
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold"
                          }`}
                        >
                          {g.grade}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {g.min}% – {g.max}%
                      </TableCell>
                      <TableCell className="font-medium">{g.remark}</TableCell>
                      <TableCell>
                        {g.isCredit ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                            Credit Pass
                          </Badge>
                        ) : g.isPass ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                            Pass
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Fail
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {g.gpa.toFixed(1)} / 4.0
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Section 3: Official 3-Term Cumulative Promotion Standards */}
          <div className="border-t pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Annual Session Promotion Benchmark
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automates end-of-year promotion recommendations based on Nigerian educational ministry regulations.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
                <Label htmlFor="passMark" className="text-xs font-medium">
                  Minimum Cumulative Average Pass Mark (%)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="passMark"
                    type="number"
                    min={30}
                    max={75}
                    value={config.passMark}
                    onChange={(e) => setConfig({ ...config, passMark: Number(e.target.value) || 50 })}
                    className="w-24 font-mono font-semibold"
                  />
                  <span className="text-xs text-muted-foreground">
                    National benchmark is 50% (Credit pass threshold)
                  </span>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
                <Label className="text-xs font-medium">
                  3-Term Cumulative Composite Weighting
                </Label>
                <Select
                  value={config.promotionWeighting}
                  onValueChange={(v: PromotionWeighting) => setConfig({ ...config, promotionWeighting: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20_20_60">
                      Term 1 (20%) + Term 2 (20%) + Term 3 (60%) [Nigerian Standard]
                    </SelectItem>
                    <SelectItem value="equal">
                      Equal Weighting (33.3% per term)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border p-4 flex items-center justify-between gap-4 bg-card">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  Enforce Mandatory Credit in English Language & Mathematics
                </Label>
                <p className="text-xs text-muted-foreground">
                  In Nigerian secondary schools, a student must score at least C6 (50%) in English and Mathematics to qualify for direct promotion.
                </p>
              </div>
              <Switch
                checked={config.requireEnglishAndMaths}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, requireEnglishAndMaths: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
