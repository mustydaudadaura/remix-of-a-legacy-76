import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generatePinBatchFn, getSchoolPinsFn, togglePinStatusFn } from "@/lib/api/pins.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreditCard,
  Printer,
  Sparkles,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  Layers,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import type { ResultCheckerPin } from "@/lib/pin-system";

interface PinBatchManagerProps {
  schoolId: string;
  schoolName?: string;
  logoUrl?: string | null;
  currentSession?: string;
}

export function PinBatchManager({
  schoolId,
  schoolName = "Result Arena Academy",
  logoUrl,
  currentSession = "2025/2026",
}: PinBatchManagerProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"inventory" | "generate" | "print">("inventory");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [session, setSession] = useState<string>(currentSession);
  const [cardCount, setCardCount] = useState<number>(20);
  const [maxUses, setMaxUses] = useState<number>(5);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [qrCache, setQrCache] = useState<Record<string, string>>({});

  // Server functions
  const generateBatch = useServerFn(generatePinBatchFn);
  const getPins = useServerFn(getSchoolPinsFn);
  const togglePin = useServerFn(togglePinStatusFn);

  // Load classes
  const { data: classes } = useQuery({
    queryKey: ["pin-classes", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name, arm")
        .eq("school_id", schoolId)
        .order("name");
      return data ?? [];
    },
  });

  // Load issued PINs
  const { data: pinsData, isLoading } = useQuery({
    queryKey: ["school-pins", schoolId, session],
    queryFn: () => getPins({ data: { school_id: schoolId, session } }),
    enabled: !!schoolId,
  });

  const cards = pinsData?.cards ?? [];

  // Generate QR codes for printable cards
  React.useEffect(() => {
    if (activeTab === "print" && cards.length > 0) {
      cards.slice(0, 40).forEach(async (c) => {
        if (!qrCache[c.id] && typeof window !== "undefined") {
          try {
            const url = `${window.location.origin}/portal/report-cards?serial=${encodeURIComponent(c.serial_no)}`;
            const qr = await QRCode.toDataURL(url, { width: 120, margin: 1 });
            setQrCache((prev) => ({ ...prev, [c.id]: qr }));
          } catch {
            // ignore
          }
        }
      });
    }
  }, [activeTab, cards]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateBatch({
        data: {
          school_id: schoolId,
          count: cardCount,
          session,
          term: "all",
          class_id: selectedClassId !== "all" ? selectedClassId : undefined,
          max_uses: maxUses,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Successfully generated ${res.count} result checker scratch cards!`);
      qc.invalidateQueries({ queryKey: ["school-pins"] });
      setActiveTab("inventory");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to generate PINs"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ pinId, active }: { pinId: string; active: boolean }) =>
      togglePin({ data: { school_id: schoolId, pin_id: pinId, is_active: active } }),
    onSuccess: () => {
      toast.success("Card status updated");
      qc.invalidateQueries({ queryKey: ["school-pins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const filteredCards = cards.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.serial_no.toLowerCase().includes(term) ||
      c.pin.replace(/-/g, "").includes(term.replace(/-/g, "")) ||
      (c.student_name && c.student_name.toLowerCase().includes(term)) ||
      (c.student_admission_no && c.student_admission_no.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Tab Navigation & Stats Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Result Checker PIN & Scratch-Card Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Issue 12-digit serial PIN tokens for secure, controlled student and parent portal access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-muted/40 p-1">
            <Button
              size="sm"
              variant={activeTab === "inventory" ? "default" : "ghost"}
              className="text-xs h-7 px-3"
              onClick={() => setActiveTab("inventory")}
            >
              Inventory ({cards.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "generate" ? "default" : "ghost"}
              className="text-xs h-7 px-3"
              onClick={() => setActiveTab("generate")}
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Batch Generator
            </Button>
            <Button
              size="sm"
              variant={activeTab === "print" ? "default" : "ghost"}
              className="text-xs h-7 px-3"
              onClick={() => setActiveTab("print")}
            >
              <Printer className="mr-1 h-3.5 w-3.5" /> Printable Cards
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-muted/20">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Cards</span>
          <p className="text-2xl font-bold font-mono mt-0.5">{pinsData?.totalCount ?? cards.length}</p>
        </Card>
        <Card className="p-3 bg-muted/20">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold text-emerald-600">Active / Usable</span>
          <p className="text-2xl font-bold font-mono mt-0.5 text-emerald-600">{pinsData?.activeCount ?? 0}</p>
        </Card>
        <Card className="p-3 bg-muted/20">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold text-amber-600">Checks Allowed</span>
          <p className="text-2xl font-bold font-mono mt-0.5">5 checks / card</p>
        </Card>
        <Card className="p-3 bg-muted/20">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold text-rose-600">Exhausted</span>
          <p className="text-2xl font-bold font-mono mt-0.5 text-rose-600">{pinsData?.exhaustedCount ?? 0}</p>
        </Card>
      </div>

      {/* TAB 1: BATCH GENERATOR */}
      {activeTab === "generate" && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate Scratch-Card PIN Tokens
            </CardTitle>
            <CardDescription className="text-xs">
              Generate 12-digit cryptographic PIN tokens and unique serial numbers. Cards can be unassigned or pre-linked to class rosters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Target Allocation</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Unassigned General Cards (Scratch-Cards)</SelectItem>
                    {classes?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.arm ? `(${c.arm})` : ""} — (Auto-Bind Roster)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground">
                  {selectedClassId === "all"
                    ? "Cards can be sold or issued to any student."
                    : "Automatically assigns 1 PIN to every student enrolled in this class."}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Academic Session</Label>
                <Input
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="e.g. 2025/2026"
                  className="font-mono"
                />
              </div>

              {selectedClassId === "all" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Number of Cards to Generate</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={cardCount}
                    onChange={(e) => setCardCount(Math.max(1, parseInt(e.target.value) || 20))}
                    className="font-mono font-semibold"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Check Limit per Card (Max Uses)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value) || 5))}
                  className="font-mono font-semibold"
                />
                <span className="text-[10px] text-muted-foreground">
                  WAEC and NECO standard is 5 checks per card.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("inventory")}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
                className="font-semibold shadow-xs"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                {generateMutation.isPending ? "Generating PINs…" : "Generate Batch Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: INVENTORY TABLE */}
      {activeTab === "inventory" && (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search serial, PIN, student or adm no…"
                className="h-8 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setActiveTab("print")}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print Cards
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => setActiveTab("generate")}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate More
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-40">Serial Number</TableHead>
                    <TableHead className="w-40">12-Digit PIN</TableHead>
                    <TableHead>Assigned Student</TableHead>
                    <TableHead className="text-center">Session</TableHead>
                    <TableHead className="text-center">Usage</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">
                        Loading scratch card inventory…
                      </TableCell>
                    </TableRow>
                  ) : filteredCards.length ? (
                    filteredCards.map((c) => {
                      const isExhausted = c.times_used >= c.max_uses;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            <div className="flex items-center gap-1.5">
                              <span>{c.serial_no}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-60 hover:opacity-100"
                                onClick={() => copyToClipboard(c.serial_no, "Serial Number")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-primary">
                            <div className="flex items-center gap-1.5">
                              <span>{c.pin}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-60 hover:opacity-100"
                                onClick={() => copyToClipboard(c.pin, "12-Digit PIN")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {c.student_name ? (
                              <div>
                                <span className="font-medium">{c.student_name}</span>
                                {c.student_admission_no && (
                                  <span className="text-[10px] text-muted-foreground block font-mono">
                                    {c.student_admission_no}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Unassigned Scratch Card</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">{c.session}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono ${
                                isExhausted
                                  ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {c.times_used} / {c.max_uses} Checks
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {!c.is_active ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Revoked
                              </Badge>
                            ) : isExhausted ? (
                              <Badge variant="secondary" className="text-[10px]">
                                Exhausted
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleMutation.mutate({ pinId: c.id, active: !c.is_active })}
                            >
                              {c.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                        No result checker PIN cards found. Click "Batch Generator" to create scratch cards.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: PRINTABLE SCRATCH CARDS SHEET */}
      {activeTab === "print" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between print:hidden bg-card p-4 rounded-xl border">
            <div>
              <h3 className="text-sm font-semibold">Printable Scratch Cards Sheet</h3>
              <p className="text-xs text-muted-foreground">
                Formatted as physical exam board scratch cards (WAEC/NECO standard) ready for cutting and distribution.
              </p>
            </div>
            <Button onClick={() => window.print()} className="font-semibold shadow-xs">
              <Printer className="mr-2 h-4 w-4" /> Print Scratch Cards Sheet
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-3">
            {cards.slice(0, 30).map((c) => (
              <div
                key={c.id}
                className="relative rounded-xl border-2 border-primary/40 bg-card p-4 shadow-sm overflow-hidden flex flex-col justify-between print:border-black print:shadow-none print:break-inside-avoid"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                        EA
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-extrabold uppercase leading-none tracking-tight">{schoolName}</h4>
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider block mt-0.5">
                        RESULT CHECKER SCRATCH CARD
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono border-primary/30">
                    {c.session}
                  </Badge>
                </div>

                {/* Serial and Scratch area */}
                <div className="space-y-2 py-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground font-medium uppercase">SERIAL NUMBER:</span>
                    <span className="font-mono font-bold text-foreground text-xs">{c.serial_no}</span>
                  </div>

                  <div className="rounded border-2 border-dashed border-primary/50 bg-muted/40 p-2.5 text-center relative">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold block mb-0.5">
                      ★ SCRATCH PIN AREA ★
                    </span>
                    <div className="font-mono text-base font-extrabold tracking-widest text-primary">
                      {c.pin}
                    </div>
                  </div>

                  {c.student_name && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      <strong>Candidate:</strong> {c.student_name} ({c.student_admission_no || "Registered"})
                    </div>
                  )}
                </div>

                {/* Footer instructions & QR */}
                <div className="border-t pt-2 mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="font-semibold text-foreground">Usage Instructions:</p>
                    <p>1. Visit school portal &gt; Report Cards.</p>
                    <p>2. Enter Serial &amp; 12-digit PIN to unlock report.</p>
                    <p className="font-bold text-primary">Valid for {c.max_uses} result checks only.</p>
                  </div>

                  {qrCache[c.id] && (
                    <img src={qrCache[c.id]} alt="QR" className="h-14 w-14 border rounded p-0.5 bg-white" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
