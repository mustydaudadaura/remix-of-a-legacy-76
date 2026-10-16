import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { PassportPhotoStudioModal } from "./PassportPhotoStudioModal";
import { SpreadsheetColumnMapperModal } from "./SpreadsheetColumnMapperModal";
import {
  analyzeAdmissionDocument,
  checkAdmissionDuplicates,
  saveAdmissionBatch,
} from "@/lib/api/admission-ai.functions";
import {
  normalizeNigerianPhone,
  validateAdmissionStudent,
  exportAdmissionBatchToExcel,
  type ExtractedAdmissionStudent,
} from "@/lib/admission-ai-helper";
import {
  Camera,
  Upload,
  FileSpreadsheet,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  Eye,
  Check,
  UserCheck,
  ExternalLink,
  Save,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const DRAFT_STORAGE_KEY = "eduerp_admission_ai_draft_v1";

export function AiAdmissionAssistant({
  onDone,
  onNavigateToAdmissions,
}: {
  onDone?: () => void;
  onNavigateToAdmissions?: () => void;
}) {
  const { schoolId } = useAuth();
  const { can } = useSchoolAccess();

  // Step 1: Input source, Step 2: Processing, Step 3: Review & Edit, Step 4: Summary
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Input states
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    kind: "image" | "pdf" | "docx" | "text";
    mime: string;
    content: string; // base64 or text
    previewUrl?: string;
  } | null>(null);

  // Spreadsheet mapping modal
  const [spreadsheetModalOpen, setSpreadsheetModalOpen] = useState(false);
  const [rawSpreadsheetData, setRawSpreadsheetData] = useState<{
    headers: string[];
    rows: Array<Record<string, any>>;
    fileName: string;
  } | null>(null);

  // Document analysis progress
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisSummary, setAnalysisSummary] = useState<string>("");

  // Extracted student records
  const [students, setStudents] = useState<ExtractedAdmissionStudent[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "ready" | "needs_review" | "duplicate">("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Passport Studio state
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [activePassportStudent, setActivePassportStudent] = useState<ExtractedAdmissionStudent | null>(null);

  // Direct enroll vs applicant registration option
  const [directEnroll, setDirectEnroll] = useState<boolean>(false);
  const [batchNotes, setBatchNotes] = useState<string>("AI Sheet Import");
  const [savingBatch, setSavingBatch] = useState<boolean>(false);

  // Saved Results state
  const [savedResult, setSavedResult] = useState<{
    total: number;
    createdCount: number;
    enrolledCount: number;
    errors: string[];
    records: Array<{ id: string; application_no: string; student_name: string; stage: string }>;
  } | null>(null);

  // Inspect document drawer / modal
  const [inspectDocOpen, setInspectDocOpen] = useState(false);

  // Load classes for this school
  const { data: classes } = useQuery({
    queryKey: ["classes-adm-ai", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").eq("school_id", schoolId!).order("name")).data ?? [],
  });
  const classList = classes ?? [];

  // Restore saved draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(`${DRAFT_STORAGE_KEY}_${schoolId}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (Array.isArray(parsed.students) && parsed.students.length > 0) {
          setStudents(parsed.students);
          setAnalysisSummary(parsed.summary || "Restored from unsaved draft");
          setSelectedStudentIds(new Set(parsed.students.map((s: any) => s.id)));
          setStep(3);
          toast.info(`Restored ${parsed.students.length} students from your previous draft.`);
        }
      }
    } catch {
      // Ignore corrupted draft
    }
  }, [schoolId]);

  // Save draft helper
  const saveDraft = () => {
    if (!students.length) return;
    try {
      localStorage.setItem(
        `${DRAFT_STORAGE_KEY}_${schoolId}`,
        JSON.stringify({
          students,
          summary: analysisSummary,
          timestamp: new Date().toISOString(),
        })
      );
      toast.success("Draft saved successfully! You can resume editing anytime.");
    } catch {
      toast.error("Failed to save draft locally.");
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${schoolId}`);
    setStudents([]);
    setUploadedFile(null);
    setRawSpreadsheetData(null);
    setSavedResult(null);
    setStep(1);
    toast.info("Admission session reset.");
  };

  // -------------------------------------------------------------
  // Input Handling: Camera
  // -------------------------------------------------------------
  const handleCameraCaptures = async (captures: Array<{ dataUrl: string; name: string }>) => {
    if (!captures.length) return;
    const first = captures[0];
    const base64Content = first.dataUrl.split(",")[1];

    setUploadedFile({
      name: first.name,
      kind: "image",
      mime: "image/jpeg",
      content: base64Content,
      previewUrl: first.dataUrl,
    });

    runDocumentAnalysis({
      name: first.name,
      kind: "image",
      mime: "image/jpeg",
      content: base64Content,
    });
  };

  // -------------------------------------------------------------
  // Input Handling: File Upload (Images, PDFs, Word DOCX, TXT)
  // -------------------------------------------------------------
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 14 * 1024 * 1024) {
      toast.error("File size exceeds 14 MB limit. Please upload a smaller file.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();

    // 1. Spreadsheet (.xlsx, .xls, .csv)
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const rawJson: any[] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName], { defval: "" });

        if (!rawJson.length) {
          toast.error("Spreadsheet is empty.");
          return;
        }

        const headers = Object.keys(rawJson[0]);
        setRawSpreadsheetData({
          headers,
          rows: rawJson,
          fileName: file.name,
        });
        setSpreadsheetModalOpen(true);
      } catch (err: any) {
        toast.error(`Could not read spreadsheet: ${err?.message}`);
      }
      return;
    }

    // 2. Word document (.docx)
    if (ext === "docx") {
      try {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        const extractedText = result.value;

        setUploadedFile({
          name: file.name,
          kind: "docx",
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          content: extractedText,
        });

        runDocumentAnalysis({
          name: file.name,
          kind: "docx",
          mime: "text/plain",
          content: extractedText,
        });
      } catch (err: any) {
        toast.error(`Could not read Word document: ${err?.message}`);
      }
      return;
    }

    // 3. Plain Text (.txt)
    if (ext === "txt") {
      try {
        const text = await file.text();
        setUploadedFile({
          name: file.name,
          kind: "text",
          mime: "text/plain",
          content: text,
        });

        runDocumentAnalysis({
          name: file.name,
          kind: "text",
          mime: "text/plain",
          content: text,
        });
      } catch (err: any) {
        toast.error(`Could not read text file: ${err?.message}`);
      }
      return;
    }

    // 4. PDF or Image
    if (ext === "pdf" || ["jpg", "jpeg", "png", "webp"].includes(ext || "")) {
      const isPdf = ext === "pdf";
      const mime = isPdf ? "application/pdf" : file.type || "image/jpeg";
      const reader = new FileReader();

      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];

        setUploadedFile({
          name: file.name,
          kind: isPdf ? "pdf" : "image",
          mime,
          content: base64,
          previewUrl: !isPdf ? dataUrl : undefined,
        });

        runDocumentAnalysis({
          name: file.name,
          kind: isPdf ? "pdf" : "image",
          mime,
          content: base64,
        });
      };

      reader.readAsDataURL(file);
      return;
    }

    toast.error("Unsupported file type. Please upload a JPG, PNG, PDF, DOCX, TXT, or Excel/CSV file.");
  };

  // -------------------------------------------------------------
  // AI Document Analysis Execution
  // -------------------------------------------------------------
  const runDocumentAnalysis = async (doc: {
    name: string;
    kind: "image" | "pdf" | "docx" | "text";
    mime: string;
    content: string;
  }) => {
    if (!schoolId) {
      toast.error("Please select a school first.");
      return;
    }

    setStep(2);
    setAnalysisStatus("Uploading and inspecting document structure...");
    setAnalysisProgress(20);

    const timer1 = setTimeout(() => {
      setAnalysisStatus("Detecting handwritten and printed registration tables...");
      setAnalysisProgress(45);
    }, 1200);

    const timer2 = setTimeout(() => {
      setAnalysisStatus("Extracting student names, Nigerian phone numbers, and classes with Gemini 3.8 Flash...");
      setAnalysisProgress(75);
    }, 2800);

    try {
      const response = await analyzeAdmissionDocument({
        data: {
          school_id: schoolId,
          file_name: doc.name,
          kind: doc.kind,
          mime: doc.mime,
          content: doc.content,
        },
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      setAnalysisProgress(90);
      setAnalysisStatus("Running duplicate checks against existing records...");

      // Run duplicate detection immediately
      const dupResult = await checkAdmissionDuplicates({
        data: {
          school_id: schoolId,
          students: response.students,
        },
      });

      setStudents(dupResult.students);
      setSelectedStudentIds(new Set(dupResult.students.map((s) => s.id)));
      setAnalysisSummary(response.summary);
      setAnalysisProgress(100);
      setStep(3);

      toast.success(
        `AI successfully extracted ${dupResult.students.length} student records (${dupResult.duplicates_count} potential duplicate flagged).`
      );
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setStep(1);
      toast.error(err?.message || "Document analysis failed. Please try a clearer scan.");
    }
  };

  // When spreadsheet columns are mapped
  const handleSpreadsheetMapped = async (mapped: ExtractedAdmissionStudent[]) => {
    if (!schoolId) return;
    setStudents(mapped);
    setSelectedStudentIds(new Set(mapped.map((s) => s.id)));
    setAnalysisSummary(`Imported ${mapped.length} records from ${rawSpreadsheetData?.fileName || "spreadsheet"}`);
    setStep(3);

    // Run duplicate detection
    try {
      const dup = await checkAdmissionDuplicates({
        data: {
          school_id: schoolId,
          students: mapped,
        },
      });
      setStudents(dup.students);
    } catch {
      // Non-fatal
    }
  };

  // -------------------------------------------------------------
  // Review & Edit Handlers
  // -------------------------------------------------------------
  const updateStudentField = (id: string, field: keyof ExtractedAdmissionStudent, value: any) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        // If class was changed, update class_name
        if (field === "class_applied_id") {
          const c = classList.find((cls) => cls.id === value);
          if (c) updated.class_name = c.name;
        }
        // Recalculate validation status
        const v = validateAdmissionStudent(updated);
        if (!v.valid) {
          updated.status = "needs_review";
          updated.review_flags = v.errors;
        } else if (!s.duplicate_info) {
          updated.status = "ready";
          updated.review_flags = [];
        }
        return updated;
      })
    );
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.info("Student removed from batch.");
  };

  const addManualStudent = () => {
    const newStudent: ExtractedAdmissionStudent = {
      id: `manual-${Date.now()}`,
      first_name: "",
      last_name: "",
      gender: "male",
      class_applied_id: classList[0]?.id,
      class_name: classList[0]?.name || "JSS 1",
      relationship: "father",
      confidence: 1.0,
      review_flags: ["Newly added row - fill in details"],
      status: "needs_review",
      is_selected: true,
    };
    setStudents((prev) => [newStudent, ...prev]);
    setSelectedStudentIds((prev) => new Set([newStudent.id, ...prev]));
    toast.success("New student row added. Fill in the details below.");
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const toggleSelectStudent = (id: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Open Passport Studio for a student
  const openPassportStudio = (student: ExtractedAdmissionStudent) => {
    setActivePassportStudent(student);
    setPassportModalOpen(true);
  };

  const handleSavePassport = (dataUrl: string) => {
    if (!activePassportStudent) return;
    updateStudentField(activePassportStudent.id, "passport_url", dataUrl);
    updateStudentField(activePassportStudent.id, "passport_data", dataUrl);
  };

  // -------------------------------------------------------------
  // Final Save to Database
  // -------------------------------------------------------------
  const handleSaveToDatabase = async () => {
    if (!schoolId) return toast.error("Please select a school.");
    const chosen = students.filter((s) => selectedStudentIds.has(s.id));
    if (!chosen.length) {
      toast.error("Please select at least one student to save.");
      return;
    }

    // Check if any selected student has critical errors
    const invalidList = chosen.filter((s) => !validateAdmissionStudent(s).valid);
    if (invalidList.length > 0) {
      toast.error(
        `${invalidList.length} student(s) have missing required fields (First and Last Name). Please fix them before saving.`
      );
      return;
    }

    setSavingBatch(true);
    try {
      const result = await saveAdmissionBatch({
        data: {
          school_id: schoolId,
          students: chosen,
          direct_enroll: directEnroll,
          batch_notes: batchNotes,
        },
      });

      setSavedResult(result);
      // Remove saved draft
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${schoolId}`);
      setStep(4);
      toast.success(
        directEnroll
          ? `Successfully saved and enrolled ${result.createdCount} students!`
          : `Successfully registered ${result.createdCount} admission applications!`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to save admission batch.");
    } finally {
      setSavingBatch(false);
    }
  };

  // -------------------------------------------------------------
  // Computed metrics
  // -------------------------------------------------------------
  const totalCount = students.length;
  const readyCount = students.filter((s) => s.status === "ready").length;
  const reviewCount = students.filter((s) => s.status === "needs_review").length;
  const duplicateCount = students.filter((s) => !!s.duplicate_info).length;
  const withPassportCount = students.filter((s) => Boolean(s.passport_url || s.passport_data)).length;

  const filteredStudents = students.filter((s) => {
    if (filterMode === "ready") return s.status === "ready";
    if (filterMode === "needs_review") return s.status === "needs_review";
    if (filterMode === "duplicate") return Boolean(s.duplicate_info);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-5 rounded-xl border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                AI Admission Assistant
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  Vision & OCR Powered
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Photograph handwritten sheets, upload registration forms, or import spreadsheets to register students.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {step === 3 && (
            <>
              <Button variant="outline" size="sm" onClick={saveDraft}>
                <Save className="h-4 w-4 mr-1 text-muted-foreground" /> Save Draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAdmissionBatchToExcel(students)}
              >
                <Download className="h-4 w-4 mr-1 text-emerald-600" /> Export Excel
              </Button>
              <Button variant="ghost" size="sm" onClick={clearDraft} className="text-muted-foreground">
                Start Over
              </Button>
            </>
          )}

          {step === 4 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAdmissionBatchToExcel(students, "Saved_Admissions_Report.xlsx")}
              >
                <Download className="h-4 w-4 mr-1 text-emerald-600" /> Download Report
              </Button>
              <Button size="sm" onClick={clearDraft}>
                Register New Batch
              </Button>
            </>
          )}
        </div>
      </div>

      {/* STEP 1: Input Choice */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Option A: Camera Capture */}
          <Card className="hover:border-primary/60 transition-all shadow-sm hover:shadow-md cursor-pointer border-2 group">
            <CardHeader className="text-center pb-2">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="h-8 w-8" />
              </div>
              <CardTitle className="text-lg mt-3">A. Camera Capture</CardTitle>
              <CardDescription className="text-xs">
                Snap photos of paper registration forms or handwritten rosters using your device camera.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-2">
              <p className="text-xs text-muted-foreground mb-4">
                Supports phones, tablets, and webcam with document border alignment and multi-page capture.
              </p>
              <Button
                className="w-full"
                onClick={() => setCameraModalOpen(true)}
              >
                <Camera className="h-4 w-4 mr-2" /> Open Camera
              </Button>
            </CardContent>
          </Card>

          {/* Option B: Document Upload */}
          <Card className="hover:border-primary/60 transition-all shadow-sm hover:shadow-md border-2 group">
            <CardHeader className="text-center pb-2">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-secondary/80 text-secondary-foreground flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="h-8 w-8" />
              </div>
              <CardTitle className="text-lg mt-3">B. Upload Document</CardTitle>
              <CardDescription className="text-xs">
                Upload image scans, scanned PDF files, Word documents, or plain text rosters.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-2">
              <p className="text-xs text-muted-foreground mb-4">
                Supported formats: <span className="font-medium text-foreground">JPG, PNG, PDF, DOCX, TXT</span> (up to 14 MB).
              </p>
              <label className="inline-block w-full">
                <Button className="w-full" variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2 text-primary" /> Choose File
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </CardContent>
          </Card>

          {/* Option C: Import Excel / CSV */}
          <Card className="hover:border-primary/60 transition-all shadow-sm hover:shadow-md border-2 group">
            <CardHeader className="text-center pb-2">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <CardTitle className="text-lg mt-3">C. Import Excel / CSV</CardTitle>
              <CardDescription className="text-xs">
                Import from external spreadsheets with flexible visual column mapping and instant validation.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-2">
              <p className="text-xs text-muted-foreground mb-4">
                Supports <span className="font-medium text-foreground">XLSX, XLS, CSV</span> with automatic Nigerian phone normalization.
              </p>
              <label className="inline-block w-full">
                <Button className="w-full" variant="outline" asChild>
                  <span>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Upload Spreadsheet
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: Processing & Extraction Progress */}
      {step === 2 && (
        <Card className="p-8 text-center max-w-xl mx-auto shadow-md">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Sparkles className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: "3s" }} />
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">AI Document Analysis in Progress</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{analysisStatus}</p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <Progress value={analysisProgress} className="h-2.5" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Reading document layout</span>
                <span>{analysisProgress}%</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground italic pt-4">
              NERDC curriculum classes, Nigerian naming patterns, and phone numbers are being preserved accurately.
            </p>
          </div>
        </Card>
      )}

      {/* STEP 3: Review, Edit & Passport Photo Studio */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Summary & Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card
              className={`cursor-pointer transition border p-3 ${
                filterMode === "all" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-card"
              }`}
              onClick={() => setFilterMode("all")}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Detected</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{totalCount}</p>
            </Card>

            <Card
              className={`cursor-pointer transition border p-3 ${
                filterMode === "ready" ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-card"
              }`}
              onClick={() => setFilterMode("ready")}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-medium">Ready to Save</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{readyCount}</p>
            </Card>

            <Card
              className={`cursor-pointer transition border p-3 ${
                filterMode === "needs_review" ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : "bg-card"
              }`}
              onClick={() => setFilterMode("needs_review")}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600 font-medium">Needs Review</span>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{reviewCount}</p>
            </Card>

            <Card
              className={`cursor-pointer transition border p-3 ${
                filterMode === "duplicate" ? "border-destructive bg-destructive/5" : "bg-card"
              }`}
              onClick={() => setFilterMode("duplicate")}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-destructive font-medium">Duplicates Flagged</span>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold mt-1 text-destructive">{duplicateCount}</p>
            </Card>

            <Card className="p-3 bg-card col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Passports Attached</span>
                <Camera className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold mt-1 text-primary">
                {withPassportCount} <span className="text-xs font-normal text-muted-foreground">/ {totalCount}</span>
              </p>
            </Card>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-lg border">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={addManualStudent}>
                <Plus className="h-4 w-4 mr-1 text-primary" /> Add Student
              </Button>

              {uploadedFile?.previewUrl && (
                <Button size="sm" variant="outline" onClick={() => setInspectDocOpen(true)}>
                  <Eye className="h-4 w-4 mr-1 text-primary" /> View Original Document
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                Selected: <span className="font-semibold text-foreground">{selectedStudentIds.size}</span> of {totalCount}
              </span>
            </div>
          </div>

          {/* Student Editable Records Table */}
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-xs">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedStudentIds.size === totalCount && totalCount > 0}
                        onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      />
                    </TableHead>
                    <TableHead className="w-14">Passport</TableHead>
                    <TableHead className="min-w-[170px]">Student Full Name *</TableHead>
                    <TableHead className="w-28">Gender</TableHead>
                    <TableHead className="w-32">Date of Birth</TableHead>
                    <TableHead className="min-w-[150px]">Class Applied</TableHead>
                    <TableHead className="min-w-[160px]">Parent / Guardian Name</TableHead>
                    <TableHead className="min-w-[140px]">Parent Phone (NG)</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-14 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredStudents.length ? (
                    filteredStudents.map((st, index) => {
                      const isSelected = selectedStudentIds.has(st.id);
                      const hasDup = Boolean(st.duplicate_info);

                      return (
                        <TableRow
                          key={st.id}
                          className={`text-xs transition ${
                            hasDup ? "bg-destructive/5 hover:bg-destructive/10" : isSelected ? "bg-primary/[0.02]" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => toggleSelectStudent(st.id, Boolean(checked))}
                            />
                          </TableCell>

                          {/* Passport Photo Studio Button */}
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => openPassportStudio(st)}
                              className="relative h-10 w-10 rounded-full border-2 border-dashed border-primary/40 bg-muted/60 overflow-hidden flex items-center justify-center hover:scale-105 transition-transform group"
                              title="Click to capture or upload student passport"
                            >
                              {st.passport_url || st.passport_data ? (
                                <img
                                  src={st.passport_url || st.passport_data}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Camera className="h-4 w-4 text-primary group-hover:scale-110" />
                              )}
                              <span className="sr-only">Passport</span>
                            </button>
                          </TableCell>

                          {/* Student Name */}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex gap-1.5">
                                <Input
                                  value={st.first_name}
                                  placeholder="First name"
                                  className="h-7 text-xs font-medium"
                                  onChange={(e) => updateStudentField(st.id, "first_name", e.target.value)}
                                />
                                <Input
                                  value={st.last_name}
                                  placeholder="Surname"
                                  className="h-7 text-xs font-medium"
                                  onChange={(e) => updateStudentField(st.id, "last_name", e.target.value)}
                                />
                              </div>
                              {st.middle_name && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Middle: {st.middle_name}
                                </p>
                              )}
                              {st.state_of_origin && (
                                <span className="inline-block text-[10px] text-muted-foreground">
                                  State: {st.state_of_origin}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Gender */}
                          <TableCell>
                            <Select
                              value={st.gender || "male"}
                              onValueChange={(v) => updateStudentField(st.id, "gender", v)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* DOB */}
                          <TableCell>
                            <Input
                              type="date"
                              value={st.dob || ""}
                              className="h-7 text-xs"
                              onChange={(e) => updateStudentField(st.id, "dob", e.target.value)}
                            />
                          </TableCell>

                          {/* Class Applied */}
                          <TableCell>
                            <Select
                              value={st.class_applied_id || ""}
                              onValueChange={(v) => updateStudentField(st.id, "class_applied_id", v)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder={st.class_name || "Choose class"} />
                              </SelectTrigger>
                              <SelectContent>
                                {classList.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Parent Name & Rel */}
                          <TableCell>
                            <div className="space-y-1">
                              <Input
                                value={st.parent_name || ""}
                                placeholder="Parent/Guardian"
                                className="h-7 text-xs"
                                onChange={(e) => updateStudentField(st.id, "parent_name", e.target.value)}
                              />
                              <div className="flex items-center gap-1">
                                <Select
                                  value={st.relationship || "father"}
                                  onValueChange={(v) => updateStudentField(st.id, "relationship", v)}
                                >
                                  <SelectTrigger className="h-6 text-[10px] py-0 px-1.5 w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="father">Father</SelectItem>
                                    <SelectItem value="mother">Mother</SelectItem>
                                    <SelectItem value="guardian">Guardian</SelectItem>
                                    <SelectItem value="sponsor">Sponsor</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </TableCell>

                          {/* Parent Phone */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <Input
                                value={st.parent_phone || ""}
                                placeholder="0803..."
                                className="h-7 text-xs font-mono"
                                onChange={(e) =>
                                  updateStudentField(st.id, "parent_phone", normalizeNigerianPhone(e.target.value))
                                }
                              />
                              {st.parent_phone && st.parent_phone.length !== 11 && (
                                <p className="text-[10px] text-amber-600">
                                  {st.parent_phone.length}/11 digits
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Status & Review Flags */}
                          <TableCell>
                            <div className="space-y-1">
                              {hasDup ? (
                                <Badge variant="destructive" className="text-[10px] font-medium" title={st.duplicate_info?.match_type}>
                                  Duplicate ({st.duplicate_info?.record_type})
                                </Badge>
                              ) : st.status === "ready" ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300">
                                  Ready
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">
                                  Needs Review
                                </Badge>
                              )}

                              {st.review_flags?.length > 0 && (
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 line-clamp-1" title={st.review_flags.join("; ")}>
                                  {st.review_flags[0]}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeStudent(st.id)}
                              title="Delete record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No students match the current filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Duplicate Warnings Banner if any */}
          {duplicateCount > 0 && (
            <Card className="border-destructive/40 bg-destructive/5 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-destructive">
                    {duplicateCount} Potential Duplicate Records Detected
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Matches were found with existing enrolled students or pending admissions in EduERP. Review each row
                    above to confirm whether to save as a new admission or skip.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Bottom Save & Confirmation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-5 rounded-xl border shadow-sm">
            <div className="flex items-center gap-3">
              <Checkbox
                id="directEnrollCheckbox"
                checked={directEnroll}
                onCheckedChange={(c) => setDirectEnroll(Boolean(c))}
              />
              <div className="space-y-0.5">
                <Label htmlFor="directEnrollCheckbox" className="text-xs font-semibold cursor-pointer">
                  Direct Enrollment (Skip applicant stage and create active student accounts)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, this immediately enrolls students into classes, creates parent profiles, and generates student admission numbers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={clearDraft}
                disabled={savingBatch}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSaveToDatabase}
                disabled={selectedStudentIds.size === 0 || savingBatch}
                className="font-medium px-6"
              >
                {savingBatch ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving Records…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {directEnroll ? "Verify & Enroll" : "Save"} {selectedStudentIds.size} Students
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Success & Registration Summary */}
      {step === 4 && savedResult && (
        <Card className="max-w-2xl mx-auto p-6 text-center space-y-6">
          <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {directEnroll ? "Students Enrolled Successfully!" : "Admission Applications Saved!"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {savedResult.createdCount} out of {savedResult.total} student records have been saved into the school management database.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left bg-muted/40 p-4 rounded-xl text-xs">
            <div>
              <span className="text-muted-foreground block">Applications Created:</span>
              <span className="text-lg font-bold">{savedResult.createdCount}</span>
            </div>
            {directEnroll && (
              <div>
                <span className="text-muted-foreground block">Active Students Enrolled:</span>
                <span className="text-lg font-bold text-emerald-600">{savedResult.enrolledCount}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground block">Errors Encountered:</span>
              <span className="text-lg font-bold text-destructive">{savedResult.errors.length}</span>
            </div>
          </div>

          {savedResult.records.length > 0 && (
            <div className="text-left space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Generated Application Numbers:</h4>
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2 bg-card">
                {savedResult.records.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1 px-2 border-b last:border-0">
                    <span className="font-medium">{r.student_name}</span>
                    <span className="font-mono text-primary font-semibold">{r.application_no}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => exportAdmissionBatchToExcel(students, "Saved_Admissions_Batch.xlsx")}
            >
              <Download className="h-4 w-4 mr-2 text-emerald-600" /> Export Excel Copy
            </Button>

            <Button
              onClick={() => {
                if (onNavigateToAdmissions) onNavigateToAdmissions();
                else clearDraft();
              }}
            >
              View Admissions List
            </Button>
          </div>
        </Card>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        onCapture={handleCameraCaptures}
        title="Photograph Registration Sheets"
      />

      {/* Passport Photo Studio Modal */}
      {activePassportStudent && (
        <PassportPhotoStudioModal
          open={passportModalOpen}
          onOpenChange={setPassportModalOpen}
          studentName={`${activePassportStudent.first_name} ${activePassportStudent.last_name}`}
          studentIdentifier={activePassportStudent.admission_no}
          currentPhotoUrl={activePassportStudent.passport_url || activePassportStudent.passport_data}
          onSavePhoto={handleSavePassport}
        />
      )}

      {/* Spreadsheet Column Mapper Modal */}
      {rawSpreadsheetData && (
        <SpreadsheetColumnMapperModal
          open={spreadsheetModalOpen}
          onOpenChange={setSpreadsheetModalOpen}
          rawHeaders={rawSpreadsheetData.headers}
          rawRows={rawSpreadsheetData.rows}
          classList={classList}
          fileName={rawSpreadsheetData.fileName}
          onMapped={handleSpreadsheetMapped}
        />
      )}

      {/* View Original Document Preview Dialog */}
      <Dialog open={inspectDocOpen} onOpenChange={setInspectDocOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Original Scanned Document
            </DialogTitle>
          </DialogHeader>
          <div className="p-2 flex items-center justify-center bg-muted/30 rounded-lg">
            {uploadedFile?.previewUrl ? (
              <img
                src={uploadedFile.previewUrl}
                alt="Original scanned document"
                className="max-h-[70vh] rounded object-contain shadow-md"
              />
            ) : (
              <p className="text-xs text-muted-foreground">No image preview available for this document type.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
