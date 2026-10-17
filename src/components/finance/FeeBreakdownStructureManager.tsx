import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  NIGERIAN_FEE_CATEGORIES,
  calculateCategoryTotals,
  formatNaira,
  sumBreakdown,
  type FeeBreakdownItem,
  type NigerianFeeCategoryId,
} from "@/lib/finance-math";
import { createFeeScheduleWithBreakdown } from "@/lib/api/fee-reconciliation.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GraduationCap,
  Users,
  Shirt,
  BookOpen,
  Home,
  Building,
  Laptop,
  FileText,
  Plus,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export function FeeBreakdownStructureManager({
  schoolId,
  invoices = [],
  items = [],
  classes = [],
  onScheduleCreated,
}: {
  schoolId: string | null;
  invoices?: any[];
  items?: any[];
  classes?: Array<{ id: string; name: string }>;
  onScheduleCreated?: () => void;
}) {
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState<"first" | "second" | "third">("first");
  const [dueDate, setDueDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preset component values
  const [tuition, setTuition] = useState("85000");
  const [pta, setPta] = useState("5000");
  const [uniforms, setUniforms] = useState("25000");
  const [books, setBooks] = useState("20000");
  const [boarding, setBoarding] = useState("0");
  const [development, setDevelopment] = useState("5000");
  const [ict, setIct] = useState("5000");

  // Calculate Category Totals across all invoices
  const categoryTotals = useMemo(() => {
    return calculateCategoryTotals(invoices);
  }, [invoices]);

  // Current proposed breakdown in modal
  const proposedBreakdown: FeeBreakdownItem[] = useMemo(() => {
    const list: FeeBreakdownItem[] = [];
    if (Number(tuition) > 0) list.push({ category: "tuition", name: "Tuition & Instruction", amount: Number(tuition), mandatory: true });
    if (Number(pta) > 0) list.push({ category: "pta", name: "PTA Levy", amount: Number(pta), mandatory: true });
    if (Number(uniforms) > 0) list.push({ category: "uniforms", name: "School Uniforms & Sportswear", amount: Number(uniforms), mandatory: true });
    if (Number(books) > 0) list.push({ category: "books", name: "Textbooks & Stationery", amount: Number(books), mandatory: true });
    if (Number(boarding) > 0) list.push({ category: "boarding", name: "Boarding & Hostel Levy", amount: Number(boarding), mandatory: true });
    if (Number(development) > 0) list.push({ category: "development", name: "Development & Maintenance", amount: Number(development), mandatory: false });
    if (Number(ict) > 0) list.push({ category: "ict", name: "ICT & Computer Lab", amount: Number(ict), mandatory: false });
    return list;
  }, [tuition, pta, uniforms, books, boarding, development, ict]);

  const compositeTotal = sumBreakdown(proposedBreakdown);

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case "tuition": return <GraduationCap className="h-4 w-4 text-blue-600" />;
      case "pta": return <Users className="h-4 w-4 text-emerald-600" />;
      case "uniforms": return <Shirt className="h-4 w-4 text-amber-600" />;
      case "books": return <BookOpen className="h-4 w-4 text-purple-600" />;
      case "boarding": return <Home className="h-4 w-4 text-rose-600" />;
      case "development": return <Building className="h-4 w-4 text-cyan-600" />;
      case "ict": return <Laptop className="h-4 w-4 text-indigo-600" />;
      case "exam": return <FileText className="h-4 w-4 text-orange-600" />;
      default: return <Layers className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedClassId) {
      toast.error("Please select a target class");
      return;
    }
    if (compositeTotal <= 0) {
      toast.error("Total composite fees must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createFeeScheduleWithBreakdown({
        data: {
          class_id: selectedClassId,
          session,
          term,
          due_date: dueDate || undefined,
          breakdown: proposedBreakdown,
        },
      });

      toast.success(`Fee structure created! Generated ${res.invoices_created} student invoices.`);
      setIsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["fee-items"] });
      qc.invalidateQueries({ queryKey: ["fee-invoices"] });
      onScheduleCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create fee schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Nigerian Statutory Fee Structure & Breakdown
          </h3>
          <p className="text-xs text-muted-foreground">
            Bursary ledger itemized across Tuition, PTA, Uniforms, Books, Boarding, and Development.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              New Class Fee Breakdown
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Layers className="h-5 w-5 text-primary" />
                Configure Class Fee Structure with Statutory Breakdown
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set itemized components (Tuition, PTA, Uniforms, Books, Boarding) and batch-generate student invoices.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Academic Session</Label>
                  <Input value={session} onChange={(e) => setSession(e.target.value)} placeholder="2025/2026" className="text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Academic Term</Label>
                  <Select value={term} onValueChange={(v: any) => setTerm(v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">First Term</SelectItem>
                      <SelectItem value="second">Second Term</SelectItem>
                      <SelectItem value="third">Third Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Due Date (Optional)</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-xs" />
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
                    Statutory Component Breakdown
                  </span>
                  <span className="font-bold text-primary font-mono text-sm">
                    Total: {formatNaira(compositeTotal)}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-blue-600" />
                      <div>
                        <span className="font-semibold text-foreground block">Tuition & Instruction</span>
                        <span className="text-[10px] text-muted-foreground">Core academic curriculum</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={tuition}
                        onChange={(e) => setTuition(e.target.value)}
                        className="h-8 text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <div>
                        <span className="font-semibold text-foreground block">PTA Levy</span>
                        <span className="text-[10px] text-muted-foreground">Parents-Teachers Association</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={pta}
                        onChange={(e) => setPta(e.target.value)}
                        className="h-8 text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                      <Shirt className="h-4 w-4 text-amber-600" />
                      <div>
                        <span className="font-semibold text-foreground block">Uniforms & Sportswear</span>
                        <span className="text-[10px] text-muted-foreground">Day wear, house wear, sports kit</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={uniforms}
                        onChange={(e) => setUniforms(e.target.value)}
                        className="h-8 text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-purple-600" />
                      <div>
                        <span className="font-semibold text-foreground block">Books & Learning Materials</span>
                        <span className="text-[10px] text-muted-foreground">Workbooks, notebooks, text package</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={books}
                        onChange={(e) => setBooks(e.target.value)}
                        className="h-8 text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-rose-600" />
                      <div>
                        <span className="font-semibold text-foreground block">Boarding House & Feeding</span>
                        <span className="text-[10px] text-muted-foreground">Hostel accommodation (Set 0 for Day)</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={boarding}
                        onChange={(e) => setBoarding(e.target.value)}
                        className="h-8 text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-cyan-600" />
                      <div>
                        <span className="font-semibold text-foreground block">Development & Infrastructure</span>
                        <span className="text-[10px] text-muted-foreground">Campus facilities maintenance</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={development}
                        onChange={(e) => setDevelopment(e.target.value)}
                        className="h-8 text-xs font-mono text-right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateSchedule} disabled={isSubmitting} className="font-medium">
                {isSubmitting ? "Generating Invoices..." : `Generate Invoices (${formatNaira(compositeTotal)})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {NIGERIAN_FEE_CATEGORIES.map((cat) => {
          const stats = categoryTotals[cat.id as NigerianFeeCategoryId] || {
            name: cat.label,
            billed: 0,
            collected: 0,
            outstanding: 0,
          };
          const collectionRate = stats.billed > 0 ? Math.round((stats.collected / stats.billed) * 100) : 100;

          return (
            <Card key={cat.id} className="rounded-xl border border-border shadow-sm hover:border-primary/30 transition">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(cat.id)}
                    <span className="font-bold text-xs text-foreground truncate max-w-[130px]">{cat.shortLabel}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {collectionRate}% Collected
                  </Badge>
                </div>

                <div>
                  <div className="text-xl font-extrabold text-foreground tracking-tight">
                    {formatNaira(stats.billed)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                    <span>Paid: <strong className="text-emerald-600">{formatNaira(stats.collected)}</strong></span>
                    <span>Due: <strong className={stats.outstanding > 0 ? "text-destructive" : "text-emerald-600"}>{formatNaira(stats.outstanding)}</strong></span>
                  </div>
                </div>

                <Progress value={collectionRate} className="h-1.5 rounded-full" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Itemized Fee Schedules Master Registry */}
      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader className="py-4 border-b border-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Class Fee Schedules & Breakdown Templates
          </CardTitle>
          <CardDescription className="text-xs">
            Standard Nigerian termly billing templates with preconfigured Tuition, PTA, Uniforms, Books, and Boarding items.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="py-2.5">Schedule Title</TableHead>
                  <TableHead className="py-2.5">Class</TableHead>
                  <TableHead className="py-2.5">Session & Term</TableHead>
                  <TableHead className="py-2.5 text-right">Composite Billed</TableHead>
                  <TableHead className="py-2.5">Nigerian Breakdown Ratios</TableHead>
                  <TableHead className="py-2.5 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                      No fee schedules configured yet. Click "New Class Fee Breakdown" to initialize.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: any) => {
                    const cls = classes.find((c) => c.id === item.class_id);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="py-3 text-xs font-semibold text-foreground">
                          {item.name}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-medium text-foreground">
                          {cls?.name ?? "General / All Classes"}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground capitalize">
                          {item.session} • {item.term} Term
                        </TableCell>
                        <TableCell className="py-3 text-xs text-right font-mono font-bold text-foreground">
                          {formatNaira(item.amount)}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold border border-blue-200">
                              Tuition (60%)
                            </span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                              PTA (5%)
                            </span>
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                              Uniforms (15%)
                            </span>
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold border border-purple-200">
                              Books (15%)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 text-[10px] uppercase font-semibold">
                            Active
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
