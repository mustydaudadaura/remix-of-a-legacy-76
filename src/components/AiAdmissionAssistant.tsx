import { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  FileSpreadsheet,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronRight,
  Download,
  Trash2,
  UserPlus,
  RefreshCw,
  Search,
  Eye,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeAdmissionDocument, batchSaveAdmissions } from "@/lib/api/admissions.functions";

export interface ExtractedStudent {
  id: string;
  source_row?: number;
  confidence: "high" | "medium" | "low";
  review_flags: string[];
  admission_no: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  gender: "male" | "female" | "";
  dob: string;
  class_id: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  relationship: string;
  address: string;
  state_of_origin: string;
  previous_school: string;
  passport_base64: string;
  notes: string;
  selected: boolean;
  duplicateWarning?: string | null;
}

interface AiAdmissionAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string | null;
  classes: { id: string; name: string }[];
  existingStudents?: { admission_no: string; first_name: string; last_name: string }[];
  onComplete: () => void;
}

export function AiAdmissionAssistant({
  open,
  onOpenChange,
  schoolId,
  classes,
  existingStudents = [],
  onComplete,
}: AiAdmissionAssistantProps) {
  // Steps: 1: capture/upload/import, 2: analyzing, 3: review/edit & passports, 4: summary
  const [step, setStep] = useState<"input" | "analyzing" | "review" | "summary">("input");
  const [activeTab, setActiveTab] = useState<"camera" | "upload" | "import">("upload");

  // Input state
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Analysis / Review state
  const [analyzingMessage, setAnalyzingMessage] = useState("Analyzing document with Vision AI…");
  const [summaryText, setSummaryText] = useState("");
  const [records, setRecords] = useState<ExtractedStudent[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "flagged" | "duplicates" | "ready">("all");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Passport capture modal
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [passportTargetId, setPassportTargetId] = useState<string | null>(null);
  const [passportCameraActive, setPassportCameraActive] = useState(false);
  const passportVideoRef = useRef<HTMLVideoElement>(null);
  const passportStreamRef = useRef<MediaStream | null>(null);

  // Save state
  const [saveMode, setSaveMode] = useState<"admissions" | "students_direct">("admissions");
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<any | null>(null);

  // Map class names to IDs
  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => {
      map.set(c.name.trim().toLowerCase(), c.id);
      map.set(c.name.trim().toLowerCase().replace(/\s+/g, ""), c.id);
    });
    return map;
  }, [classes]);

  // Clean camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopPassportCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      toast.error("Could not access camera: " + (err?.message || "Check permissions"));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPreview(dataUrl);
    stopCamera();
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        return toast.error("File size must be under 20MB");
      }
      setDocumentFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setCapturedPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setCapturedPreview(null);
      }
    }
  };

  const startPassportCamera = async (targetId: string) => {
    setPassportTargetId(targetId);
    setPassportModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      passportStreamRef.current = stream;
      setPassportCameraActive(true);
      setTimeout(() => {
        if (passportVideoRef.current) {
          passportVideoRef.current.srcObject = stream;
          passportVideoRef.current.play();
        }
      }, 100);
    } catch (err: any) {
      toast.error("Could not access camera for passport: " + (err?.message || "Check permissions"));
    }
  };

  const stopPassportCamera = () => {
    if (passportStreamRef.current) {
      passportStreamRef.current.getTracks().forEach((t) => t.stop());
      passportStreamRef.current = null;
    }
    setPassportCameraActive(false);
  };

  const capturePassportPhoto = () => {
    if (!passportVideoRef.current || !passportTargetId) return;
    const canvas = document.createElement("canvas");
    // Standard 3:4 passport aspect ratio
    canvas.width = 450;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const v = passportVideoRef.current;
    const vWidth = v.videoWidth || 640;
    const vHeight = v.videoHeight || 480;

    // Crop center to 3:4
    const targetRatio = 3 / 4;
    let sWidth = vWidth;
    let sHeight = vWidth / targetRatio;
    if (sHeight > vHeight) {
      sHeight = vHeight;
      sWidth = vHeight * targetRatio;
    }
    const sx = (vWidth - sWidth) / 2;
    const sy = (vHeight - sHeight) / 2;

    ctx.drawImage(v, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    setRecords((prev) =>
      prev.map((r) => (r.id === passportTargetId ? { ...r, passport_base64: dataUrl } : r))
    );
    stopPassportCamera();
    setPassportModalOpen(false);
    toast.success("Passport photograph captured");
  };

  const handlePassportUpload = (targetId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRecords((prev) =>
        prev.map((r) => (r.id === targetId ? { ...r, passport_base64: reader.result as string } : r))
      );
      toast.success("Passport photo attached");
    };
    reader.readAsDataURL(file);
  };

  // Process Excel/CSV Import directly without AI
  const handleSpreadsheetImport = async (file: File) => {
    try {
      setStep("analyzing");
      setAnalyzingMessage("Reading spreadsheet rows and matching classes…");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });

      if (!rawData.length) {
        throw new Error("The spreadsheet is empty. Please ensure rows exist.");
      }

      const parsedRecords: ExtractedStudent[] = rawData.map((row, idx) => {
        const normKey: Record<string, any> = {};
        for (const k of Object.keys(row)) {
          const cleanK = k.trim().toLowerCase().replace(/[\s_-]+/g, "");
          normKey[cleanK] = row[k];
        }

        const firstName = String(normKey["firstname"] || normKey["first"] || normKey["studentname"]?.split(" ")[0] || "").trim();
        const lastName = String(normKey["lastname"] || normKey["surname"] || normKey["last"] || normKey["studentname"]?.split(" ").slice(1).join(" ") || "").trim();
        const middleName = String(normKey["middlename"] || normKey["othernames"] || normKey["middle"] || "").trim();
        const admNo = String(normKey["admissionno"] || normKey["admissionnumber"] || normKey["regno"] || normKey["appno"] || "").trim();
        const genderRaw = String(normKey["gender"] || normKey["sex"] || "").trim().toLowerCase();
        const gender: "male" | "female" | "" = genderRaw.startsWith("f") ? "female" : genderRaw.startsWith("m") ? "male" : "";
        
        let dobStr = "";
        const rawDob = normKey["dob"] || normKey["dateofbirth"];
        if (rawDob instanceof Date) {
          dobStr = rawDob.toISOString().slice(0, 10);
        } else if (rawDob) {
          dobStr = String(rawDob).trim();
        }

        const className = String(normKey["class"] || normKey["classname"] || normKey["classapplied"] || "").trim();
        const matchedClassId = classMap.get(className.toLowerCase()) || classMap.get(className.toLowerCase().replace(/\s+/g, "")) || "";

        const parentName = String(normKey["parentname"] || normKey["guardianname"] || normKey["fathername"] || normKey["mothername"] || "").trim();
        const parentPhone = String(normKey["parentphone"] || normKey["phone"] || normKey["phonenumber"] || normKey["mobile"] || "").trim();
        const parentEmail = String(normKey["parentemail"] || normKey["email"] || "").trim();

        // Check for duplicates in existing database
        let duplicateWarning: string | null = null;
        if (admNo && existingStudents.some((s) => s.admission_no.toLowerCase() === admNo.toLowerCase())) {
          duplicateWarning = `Admission No "${admNo}" already exists in the school database`;
        } else if (
          firstName &&
          lastName &&
          existingStudents.some(
            (s) =>
              s.first_name.toLowerCase() === firstName.toLowerCase() &&
              s.last_name.toLowerCase() === lastName.toLowerCase()
          )
        ) {
          duplicateWarning = `Name "${firstName} ${lastName}" matches an enrolled student`;
        }

        return {
          id: `row-${Date.now()}-${idx}`,
          source_row: idx + 1,
          confidence: "high",
          review_flags: [],
          admission_no: admNo,
          first_name: firstName || "Student",
          last_name: lastName || `#${idx + 1}`,
          middle_name: middleName,
          gender,
          dob: dobStr,
          class_id: matchedClassId,
          class_name: className,
          parent_name: parentName,
          parent_phone: parentPhone,
          parent_email: parentEmail,
          relationship: "father",
          address: String(normKey["address"] || "").trim(),
          state_of_origin: String(normKey["stateoforigin"] || normKey["state"] || "").trim(),
          previous_school: String(normKey["previousschool"] || "").trim(),
          passport_base64: "",
          notes: String(normKey["notes"] || normKey["remark"] || "").trim(),
          selected: true,
          duplicateWarning,
        };
      });

      setSummaryText(`Imported ${parsedRecords.length} records from spreadsheet file "${file.name}".`);
      setRecords(parsedRecords);
      setStep("review");
    } catch (err: any) {
      toast.error("Spreadsheet import failed: " + (err?.message || "Invalid file"));
      setStep("input");
    }
  };

  // Run AI Document Analysis
  const runAiAnalysis = async (contentBase64OrText: string, kind: "image" | "pdf" | "text", mime: string, fileName: string) => {
    if (!schoolId) {
      return toast.error("Please select a school first");
    }
    setStep("analyzing");
    setAnalyzingMessage("Analyzing document with Gemini Vision OCR… Detecting students, handwriting and parent details…");

    try {
      const response = await analyzeAdmissionDocument({
        data: {
          school_id: schoolId,
          file_name: fileName,
          kind,
          mime,
          content: contentBase64OrText,
          class_names: classes.map((c) => c.name),
        },
      });

      if (!response || !response.records?.length) {
        toast.error("No student records could be detected in this document. You can add entries manually.");
        setRecords([]);
        setSummaryText("No records detected");
        setStep("review");
        return;
      }

      // Map response to internal records with duplicate detection
      const mapped: ExtractedStudent[] = response.records.map((r: any, idx: number) => {
        const fn = (r.first_name || "").trim();
        const ln = (r.last_name || "").trim();
        const adm = (r.admission_no || "").trim();
        const rawClass = (r.class_applied || "").trim();
        const matchedClassId =
          classMap.get(rawClass.toLowerCase()) ||
          classMap.get(rawClass.toLowerCase().replace(/\s+/g, "")) ||
          "";

        let duplicateWarning: string | null = null;
        if (adm && existingStudents.some((s) => s.admission_no.toLowerCase() === adm.toLowerCase())) {
          duplicateWarning = `Admission No "${adm}" already exists in the school database`;
        } else if (
          fn &&
          ln &&
          existingStudents.some(
            (s) =>
              s.first_name.toLowerCase() === fn.toLowerCase() &&
              s.last_name.toLowerCase() === ln.toLowerCase()
          )
        ) {
          duplicateWarning = `Name "${fn} ${ln}" matches an enrolled student`;
        }

        return {
          id: `ai-${Date.now()}-${idx}`,
          source_row: r.source_row || idx + 1,
          confidence: r.confidence || "high",
          review_flags: Array.isArray(r.review_flags) ? r.review_flags : [],
          admission_no: adm,
          first_name: fn || "Student",
          last_name: ln || `#${idx + 1}`,
          middle_name: (r.middle_name || "").trim(),
          gender: r.gender === "female" ? "female" : r.gender === "male" ? "male" : "",
          dob: r.dob || "",
          class_id: matchedClassId,
          class_name: rawClass,
          parent_name: (r.parent_name || "").trim(),
          parent_phone: (r.parent_phone || "").trim(),
          parent_email: (r.parent_email || "").trim(),
          relationship: r.relationship || "father",
          address: (r.address || "").trim(),
          state_of_origin: (r.state_of_origin || "").trim(),
          previous_school: (r.previous_school || "").trim(),
          passport_base64: "",
          notes: (r.notes || "").trim(),
          selected: true,
          duplicateWarning,
        };
      });

      setSummaryText(response.summary || `Extracted ${mapped.length} students from document.`);
      setRecords(mapped);
      setStep("review");
      toast.success(`AI extracted ${mapped.length} student records successfully!`);
    } catch (err: any) {
      toast.error("Analysis failed: " + (err?.message || "Unknown error"));
      setStep("input");
    }
  };

  // Trigger analysis for image/camera/document
  const handleStartAnalysis = async () => {
    if (activeTab === "camera" && capturedPreview) {
      const base64Data = capturedPreview.split(",")[1];
      await runAiAnalysis(base64Data, "image", "image/jpeg", "camera_capture.jpg");
    } else if (activeTab === "upload" && documentFile) {
      if (documentFile.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = async () => {
          const res = reader.result as string;
          const base64Data = res.split(",")[1];
          await runAiAnalysis(base64Data, "pdf", "application/pdf", documentFile.name);
        };
        reader.readAsDataURL(documentFile);
      } else if (documentFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = async () => {
          const res = reader.result as string;
          const base64Data = res.split(",")[1];
          await runAiAnalysis(base64Data, "image", documentFile.type, documentFile.name);
        };
        reader.readAsDataURL(documentFile);
      } else if (
        documentFile.name.endsWith(".txt") ||
        documentFile.type.includes("text")
      ) {
        const text = await documentFile.text();
        await runAiAnalysis(text, "text", "text/plain", documentFile.name);
      } else {
        toast.error("Unsupported file type for Vision AI. Please upload JPG, PNG, PDF, or text.");
      }
    } else if (activeTab === "import" && documentFile) {
      await handleSpreadsheetImport(documentFile);
    }
  };

  // Add manual student
  const handleAddManualStudent = () => {
    const newStudent: ExtractedStudent = {
      id: `manual-${Date.now()}`,
      source_row: records.length + 1,
      confidence: "high",
      review_flags: [],
      admission_no: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      gender: "male",
      dob: "",
      class_id: classes[0]?.id || "",
      class_name: classes[0]?.name || "",
      parent_name: "",
      parent_phone: "",
      parent_email: "",
      relationship: "father",
      address: "",
      state_of_origin: "",
      previous_school: "",
      passport_base64: "",
      notes: "",
      selected: true,
      duplicateWarning: null,
    };
    setRecords((prev) => [newStudent, ...prev]);
    setSelectedRecordId(newStudent.id);
    toast.info("Added empty student record for editing");
  };

  // Batch save
  const handleSaveApprovedRecords = async () => {
    const selected = records.filter((r) => r.selected);
    if (!selected.length) {
      return toast.error("No students selected for registration");
    }
    // Validation
    const invalid = selected.filter((r) => !r.first_name?.trim() || !r.last_name?.trim());
    if (invalid.length > 0) {
      return toast.error(`Please provide first and last names for all selected students (${invalid.length} missing)`);
    }

    if (!schoolId) return toast.error("Select a school first");

    setIsSaving(true);
    try {
      const res = await batchSaveAdmissions({
        data: {
          school_id: schoolId,
          save_mode: saveMode,
          records: selected.map((r) => ({
            id: r.id,
            admission_no: r.admission_no || undefined,
            first_name: r.first_name,
            last_name: r.last_name,
            middle_name: r.middle_name || null,
            gender: r.gender ? (r.gender as "male" | "female") : null,
            dob: r.dob || null,
            class_id: r.class_id || null,
            class_name: r.class_name || null,
            parent_name: r.parent_name || null,
            parent_phone: r.parent_phone || null,
            parent_email: r.parent_email || null,
            relationship: r.relationship || "father",
            address: r.address || null,
            state_of_origin: r.state_of_origin || null,
            previous_school: r.previous_school || null,
            passport_base64: r.passport_base64 || null,
            notes: r.notes || null,
          })),
        },
      });

      setSaveResult(res);
      setStep("summary");
      toast.success(`Successfully processed ${res.successCount} student records!`);
      onComplete();
    } catch (err: any) {
      toast.error("Saving failed: " + (err?.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Genuine Excel (.xlsx)
  const handleExportExcel = () => {
    if (!records.length) return toast.error("No records to export");
    const exportData = records.map((r, i) => ({
      "S/N": i + 1,
      "Admission No": r.admission_no || "",
      "First Name": r.first_name,
      "Middle Name": r.middle_name,
      "Last Name": r.last_name,
      Gender: r.gender,
      "Date of Birth": r.dob,
      Class: classes.find((c) => c.id === r.class_id)?.name || r.class_name || "",
      "Parent Name": r.parent_name,
      "Parent Phone": r.parent_phone, // Preserved as text string
      "Parent Email": r.parent_email,
      Relationship: r.relationship,
      Address: r.address,
      "State of Origin": r.state_of_origin,
      "Previous School": r.previous_school,
      "Confidence Level": r.confidence,
      "Review Notes": r.review_flags.join("; "),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    // Auto-fit column widths
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length + 4, 14),
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extracted Admissions");
    XLSX.writeFile(wb, `Admission_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel sheet exported successfully");
  };

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (activeFilter === "flagged" && r.confidence === "high" && !r.review_flags.length) return false;
      if (activeFilter === "duplicates" && !r.duplicateWarning) return false;
      if (activeFilter === "ready" && (!r.first_name || !r.last_name || r.duplicateWarning)) return false;

      if (!searchFilter.trim()) return true;
      const term = searchFilter.toLowerCase();
      return (
        r.first_name.toLowerCase().includes(term) ||
        r.last_name.toLowerCase().includes(term) ||
        r.admission_no.toLowerCase().includes(term) ||
        r.parent_name.toLowerCase().includes(term) ||
        r.parent_phone.includes(term)
      );
    });
  }, [records, activeFilter, searchFilter]);

  const flaggedCount = records.filter((r) => r.confidence !== "high" || r.review_flags.length > 0).length;
  const duplicateCount = records.filter((r) => !!r.duplicateWarning).length;
  const readyCount = records.filter((r) => r.first_name && r.last_name && !r.duplicateWarning).length;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            stopCamera();
            stopPassportCamera();
          }
          onOpenChange(v);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-5 border-b border-border bg-card/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    AI Admission Assistant
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wider">
                      OCR & Vision
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Photograph handwritten sheets, upload documents or spreadsheets to extract, review & register students.
                  </DialogDescription>
                </div>
              </div>

              {step === "review" && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportExcel} className="text-xs">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export Excel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleAddManualStudent} className="text-xs">
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Add Student
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* STEP 1: INPUT MODES */}
            {step === "input" && (
              <div className="space-y-5">
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="upload" className="text-xs">
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Document
                    </TabsTrigger>
                    <TabsTrigger value="camera" className="text-xs">
                      <Camera className="mr-1.5 h-3.5 w-3.5" /> Camera Capture
                    </TabsTrigger>
                    <TabsTrigger value="import" className="text-xs">
                      <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel / CSV
                    </TabsTrigger>
                  </TabsList>

                  {/* Upload Tab */}
                  <TabsContent value="upload" className="space-y-4 pt-3">
                    <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition hover:bg-muted/40">
                      <Upload className="mx-auto h-10 w-10 text-muted-foreground/70" />
                      <h3 className="mt-3 font-semibold text-sm">Upload Admission Documents or Photos</h3>
                      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                        Supports photo scans (JPG, PNG, WebP), PDF application forms, and printed or handwritten registration sheets.
                      </p>
                      <label className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 cursor-pointer">
                        <span>Browse Files</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf,.docx,.txt"
                          className="hidden"
                          onChange={handleDocumentSelect}
                        />
                      </label>
                      {documentFile && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          <FileText className="h-3.5 w-3.5" />
                          <span>{documentFile.name} ({(documentFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                    </div>

                    {capturedPreview && (
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Image Preview</p>
                        <img
                          src={capturedPreview}
                          alt="Document Preview"
                          className="max-h-60 rounded object-contain mx-auto"
                        />
                      </div>
                    )}
                  </TabsContent>

                  {/* Camera Tab */}
                  <TabsContent value="camera" className="space-y-4 pt-3">
                    <div className="relative rounded-xl border border-border bg-black/90 p-4 text-center overflow-hidden min-h-[300px] flex flex-col items-center justify-center">
                      {!isCameraActive && !capturedPreview && (
                        <div className="space-y-3">
                          <Camera className="mx-auto h-12 w-12 text-white/60" />
                          <p className="text-xs text-white/80 max-w-sm">
                            Hold the camera steady directly above the handwritten paper or registration ledger with good lighting.
                          </p>
                          <Button onClick={startCamera} size="sm">
                            Open Camera
                          </Button>
                        </div>
                      )}

                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className={`max-h-[360px] w-full object-contain rounded ${
                          isCameraActive ? "block" : "hidden"
                        }`}
                      />

                      {capturedPreview && !isCameraActive && (
                        <div className="space-y-3">
                          <img
                            src={capturedPreview}
                            alt="Captured photo"
                            className="max-h-[320px] rounded object-contain mx-auto"
                          />
                          <div className="flex justify-center gap-2">
                            <Button variant="secondary" size="sm" onClick={startCamera}>
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                              Retake Photo
                            </Button>
                          </div>
                        </div>
                      )}

                      {isCameraActive && (
                        <div className="absolute bottom-4 flex gap-3">
                          <Button onClick={capturePhoto} size="sm" className="shadow-lg">
                            <Camera className="mr-1.5 h-4 w-4" />
                            Capture Photo
                          </Button>
                          <Button variant="secondary" size="sm" onClick={stopCamera}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Excel / CSV Tab */}
                  <TabsContent value="import" className="space-y-4 pt-3">
                    <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center">
                      <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground/70" />
                      <h3 className="mt-3 font-semibold text-sm">Direct Spreadsheet Import</h3>
                      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                        Upload XLSX or CSV rosters. Column mappings (name, admission number, parent phone, class) will be automatically detected.
                      </p>
                      <label className="mt-4 inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground shadow hover:bg-secondary/80 cursor-pointer">
                        <span>Select Excel or CSV</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setDocumentFile(f);
                              handleSpreadsheetImport(f);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      (activeTab === "camera" && !capturedPreview) ||
                      (activeTab === "upload" && !documentFile)
                    }
                    onClick={handleStartAnalysis}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Analyze & Extract
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: ANALYZING SPINNER */}
            {step === "analyzing" && (
              <div className="py-16 text-center space-y-4">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Processing Document</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">{analyzingMessage}</p>
              </div>
            )}

            {/* STEP 3: REVIEW & EDIT RECORDS */}
            {step === "review" && (
              <div className="space-y-4">
                {/* Top Metrics Bar */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    onClick={() => setActiveFilter("all")}
                    className={`rounded-lg border p-3 text-left transition ${
                      activeFilter === "all" ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <span className="text-[11px] text-muted-foreground">Total Detected</span>
                    <p className="text-lg font-bold">{records.length}</p>
                  </button>
                  <button
                    onClick={() => setActiveFilter("ready")}
                    className={`rounded-lg border p-3 text-left transition ${
                      activeFilter === "ready" ? "border-emerald-500 bg-emerald-50/40" : "border-border bg-card"
                    }`}
                  >
                    <span className="text-[11px] text-emerald-700">Ready to Save</span>
                    <p className="text-lg font-bold text-emerald-700">{readyCount}</p>
                  </button>
                  <button
                    onClick={() => setActiveFilter("flagged")}
                    className={`rounded-lg border p-3 text-left transition ${
                      activeFilter === "flagged" ? "border-amber-500 bg-amber-50/40" : "border-border bg-card"
                    }`}
                  >
                    <span className="text-[11px] text-amber-700">Needs Review / Flags</span>
                    <p className="text-lg font-bold text-amber-700">{flaggedCount}</p>
                  </button>
                  <button
                    onClick={() => setActiveFilter("duplicates")}
                    className={`rounded-lg border p-3 text-left transition ${
                      activeFilter === "duplicates" ? "border-rose-500 bg-rose-50/40" : "border-border bg-card"
                    }`}
                  >
                    <span className="text-[11px] text-rose-700">Possible Duplicates</span>
                    <p className="text-lg font-bold text-rose-700">{duplicateCount}</p>
                  </button>
                </div>

                {summaryText && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground flex items-center justify-between">
                    <span>{summaryText}</span>
                    <Button variant="ghost" size="sm" onClick={() => setStep("input")} className="h-6 text-[10px]">
                      Upload another document
                    </Button>
                  </div>
                )}

                {/* Filter & Selection Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search extracted names or phone…"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const allSelected = records.every((r) => r.selected);
                        setRecords((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
                      }}
                    >
                      {records.every((r) => r.selected) ? "Deselect All" : "Select All"}
                    </Button>

                    <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-card">
                      <Label htmlFor="saveMode" className="text-[11px] text-muted-foreground">Target:</Label>
                      <select
                        id="saveMode"
                        value={saveMode}
                        onChange={(e: any) => setSaveMode(e.target.value)}
                        className="bg-transparent text-xs font-semibold outline-none"
                      >
                        <option value="admissions">Admission Applications (Pending Review)</option>
                        <option value="students_direct">Direct Student Enrollment (Admitted)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Extracted Records Table */}
                <div className="rounded-lg border border-border overflow-hidden bg-card">
                  <div className="max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                        <tr>
                          <th className="p-2.5 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={records.length > 0 && records.every((r) => r.selected)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setRecords((prev) => prev.map((r) => ({ ...r, selected: checked })));
                              }}
                            />
                          </th>
                          <th className="p-2.5 w-12">Passport</th>
                          <th className="p-2.5">Student Name</th>
                          <th className="p-2.5">Gender / DOB</th>
                          <th className="p-2.5">Class</th>
                          <th className="p-2.5">Parent / Phone</th>
                          <th className="p-2.5">Origin / Prev School</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right w-16">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredRecords.length ? (
                          filteredRecords.map((r) => (
                            <tr
                              key={r.id}
                              className={`transition hover:bg-muted/40 ${
                                !r.selected ? "opacity-50" : ""
                              } ${r.duplicateWarning ? "bg-rose-50/30" : ""}`}
                            >
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={r.selected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setRecords((prev) =>
                                      prev.map((item) => (item.id === r.id ? { ...item, selected: checked } : item))
                                    );
                                  }}
                                />
                              </td>
                              <td className="p-2.5">
                                <div className="relative group">
                                  {r.passport_base64 ? (
                                    <img
                                      src={r.passport_base64}
                                      alt="Passport"
                                      className="h-9 w-8 object-cover rounded border border-border"
                                    />
                                  ) : (
                                    <div className="h-9 w-8 rounded border border-dashed border-border bg-muted/40 flex items-center justify-center text-muted-foreground">
                                      <Camera className="h-3.5 w-3.5" />
                                    </div>
                                  )}
                                  <button
                                    onClick={() => startPassportCamera(r.id)}
                                    title="Take / Replace Passport"
                                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 opacity-80 hover:opacity-100 shadow"
                                  >
                                    <Camera className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-2.5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      value={r.first_name}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setRecords((prev) =>
                                          prev.map((it) => (it.id === r.id ? { ...it, first_name: v } : it))
                                        );
                                      }}
                                      placeholder="First name"
                                      className="h-6 w-24 text-xs font-semibold px-1.5"
                                    />
                                    <Input
                                      value={r.last_name}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setRecords((prev) =>
                                          prev.map((it) => (it.id === r.id ? { ...it, last_name: v } : it))
                                        );
                                      }}
                                      placeholder="Last name"
                                      className="h-6 w-24 text-xs font-semibold px-1.5"
                                    />
                                  </div>
                                  <Input
                                    value={r.middle_name}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setRecords((prev) =>
                                        prev.map((it) => (it.id === r.id ? { ...it, middle_name: v } : it))
                                      );
                                    }}
                                    placeholder="Middle name"
                                    className="h-5 w-44 text-[10px] text-muted-foreground px-1.5"
                                  />
                                </div>
                              </td>
                              <td className="p-2.5">
                                <div className="space-y-1">
                                  <select
                                    value={r.gender}
                                    onChange={(e) => {
                                      const v = e.target.value as any;
                                      setRecords((prev) =>
                                        prev.map((it) => (it.id === r.id ? { ...it, gender: v } : it))
                                      );
                                    }}
                                    className="h-6 rounded border border-border bg-background px-1 text-[11px]"
                                  >
                                    <option value="">Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                  </select>
                                  <Input
                                    type="date"
                                    value={r.dob}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setRecords((prev) =>
                                        prev.map((it) => (it.id === r.id ? { ...it, dob: v } : it))
                                      );
                                    }}
                                    className="h-5 w-28 text-[10px] px-1"
                                  />
                                </div>
                              </td>
                              <td className="p-2.5">
                                <select
                                  value={r.class_id}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setRecords((prev) =>
                                      prev.map((it) => (it.id === r.id ? { ...it, class_id: v } : it))
                                    );
                                  }}
                                  className="h-6 w-28 rounded border border-border bg-background px-1 text-xs"
                                >
                                  <option value="">Select class</option>
                                  {classes.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2.5">
                                <div className="space-y-1">
                                  <Input
                                    value={r.parent_name}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setRecords((prev) =>
                                        prev.map((it) => (it.id === r.id ? { ...it, parent_name: v } : it))
                                      );
                                    }}
                                    placeholder="Parent name"
                                    className="h-6 w-32 text-xs px-1.5"
                                  />
                                  <Input
                                    value={r.parent_phone}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setRecords((prev) =>
                                        prev.map((it) => (it.id === r.id ? { ...it, parent_phone: v } : it))
                                      );
                                    }}
                                    placeholder="08031234567"
                                    className="h-5 w-32 text-[10px] font-mono px-1.5"
                                  />
                                </div>
                              </td>
                              <td className="p-2.5">
                                <div className="space-y-1">
                                  <Input
                                    value={r.state_of_origin}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setRecords((prev) =>
                                        prev.map((it) => (it.id === r.id ? { ...it, state_of_origin: v } : it))
                                      );
                                    }}
                                    placeholder="State"
                                    className="h-5 w-24 text-[10px] px-1"
                                  />
                                  <Input
                                    value={r.previous_school}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setRecords((prev) =>
                                        prev.map((it) => (it.id === r.id ? { ...it, previous_school: v } : it))
                                      );
                                    }}
                                    placeholder="Prev school"
                                    className="h-5 w-24 text-[10px] px-1"
                                  />
                                </div>
                              </td>
                              <td className="p-2.5">
                                {r.duplicateWarning ? (
                                  <Badge variant="destructive" className="text-[9px] gap-1 px-1.5 py-0.5">
                                    <AlertTriangle className="h-3 w-3" /> Duplicate
                                  </Badge>
                                ) : r.confidence === "low" ? (
                                  <Badge variant="secondary" className="text-[9px] bg-amber-500/10 text-amber-700">
                                    Low Conf
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-700">
                                    Ready
                                  </Badge>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => setRecords((prev) => prev.filter((it) => it.id !== r.id))}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-muted-foreground">
                              No records match the current filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    Selected: <strong className="text-foreground">{records.filter((r) => r.selected).length}</strong> of {records.length} students
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("input")} className="text-xs">
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveApprovedRecords}
                      disabled={isSaving || !records.some((r) => r.selected)}
                      className="text-xs font-semibold shadow-sm"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Saving Records…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Verify & Save Approved Records
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: SUMMARY & CONFIRMATION */}
            {step === "summary" && saveResult && (
              <div className="py-8 space-y-6 text-center max-w-lg mx-auto">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Admission Registration Complete</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Successfully saved {saveResult.successCount} student records directly into the school database.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 text-left divide-y divide-border text-xs max-h-56 overflow-y-auto">
                  {saveResult.results.map((r: any, idx: number) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{r.number}</p>
                      </div>
                      {r.status === "success" ? (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 text-[10px]">
                          Saved
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          {r.error || "Failed"}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStep("input");
                      setRecords([]);
                      setCapturedPreview(null);
                      setDocumentFile(null);
                    }}
                  >
                    Register More Students
                  </Button>
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Passport Capture Modal */}
      <Dialog
        open={passportModalOpen}
        onOpenChange={(v) => {
          if (!v) stopPassportCamera();
          setPassportModalOpen(v);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4" /> Student Passport Photograph
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="relative mx-auto h-72 w-56 rounded-lg border-2 border-dashed border-primary/40 bg-black/90 overflow-hidden flex items-center justify-center">
              <video
                ref={passportVideoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-white/20 pointer-events-none rounded-lg" />
              <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
                3:4 Portrait
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={capturePassportPhoto}>
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                Capture Passport
              </Button>
              <div className="flex items-center justify-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer">
                  <Upload className="h-3 w-3" /> Or upload photo file
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (passportTargetId) {
                        handlePassportUpload(passportTargetId, e);
                        stopPassportCamera();
                        setPassportModalOpen(false);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
