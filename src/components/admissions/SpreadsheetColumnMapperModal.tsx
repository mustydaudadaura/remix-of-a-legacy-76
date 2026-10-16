import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  normalizeNigerianPhone,
  type ExtractedAdmissionStudent,
} from "@/lib/admission-ai-helper";
import { FileSpreadsheet, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

interface SpreadsheetColumnMapperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawRows: Array<Record<string, any>>;
  rawHeaders: string[];
  classList: Array<{ id: string; name: string }>;
  fileName: string;
  onMapped: (students: ExtractedAdmissionStudent[]) => void;
}

const TARGET_FIELDS = [
  { key: "first_name", label: "First Name / Given Name", required: true },
  { key: "last_name", label: "Last Name / Surname", required: true },
  { key: "middle_name", label: "Middle Name", required: false },
  { key: "gender", label: "Gender (Male/Female)", required: false },
  { key: "dob", label: "Date of Birth", required: false },
  { key: "admission_no", label: "Admission / App No", required: false },
  { key: "class_name", label: "Class / Grade", required: false },
  { key: "parent_name", label: "Parent / Guardian Name", required: false },
  { key: "parent_phone", label: "Parent Phone Number", required: false },
  { key: "parent_email", label: "Parent Email", required: false },
  { key: "relationship", label: "Relationship (Father/Mother/etc)", required: false },
  { key: "state_of_origin", label: "State of Origin", required: false },
  { key: "residential_address", label: "Residential Address", required: false },
  { key: "previous_school", label: "Previous School", required: false },
] as const;

export function SpreadsheetColumnMapperModal({
  open,
  onOpenChange,
  rawRows,
  rawHeaders,
  classList,
  fileName,
  onMapped,
}: SpreadsheetColumnMapperModalProps) {
  // Auto-detect mappings from header names
  const initialMapping = useMemo(() => {
    const map: Record<string, string> = {};
    rawHeaders.forEach((header) => {
      const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (h.includes("firstname") || h === "fname" || h === "givenname") map[header] = "first_name";
      else if (h.includes("lastname") || h.includes("surname") || h === "lname") map[header] = "last_name";
      else if (h.includes("middlename") || h === "mname" || h === "othername") map[header] = "middle_name";
      else if (h.includes("gender") || h === "sex") map[header] = "gender";
      else if (h.includes("dob") || h.includes("birth") || h.includes("dateofbirth")) map[header] = "dob";
      else if (h.includes("adm") || h.includes("regno") || h.includes("studentno") || h.includes("appno")) map[header] = "admission_no";
      else if (h.includes("class") || h.includes("grade") || h.includes("arm")) map[header] = "class_name";
      else if (h.includes("parentname") || h.includes("guardian") || h.includes("father") || h.includes("mother")) map[header] = "parent_name";
      else if (h.includes("phone") || h.includes("mobile") || h.includes("gsm") || h.includes("tel")) map[header] = "parent_phone";
      else if (h.includes("email")) map[header] = "parent_email";
      else if (h.includes("state") || h.includes("origin")) map[header] = "state_of_origin";
      else if (h.includes("address") || h.includes("residence")) map[header] = "residential_address";
      else if (h.includes("prevschool") || h.includes("former")) map[header] = "previous_school";
    });
    return map;
  }, [rawHeaders]);

  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Sync initial mapping when headers change
  useMemo(() => {
    setMapping(initialMapping);
  }, [initialMapping]);

  const updateMapping = (header: string, targetField: string) => {
    setMapping((prev) => ({
      ...prev,
      [header]: targetField === "unmapped" ? "" : targetField,
    }));
  };

  const previewStudents = useMemo(() => {
    const mappedEntries = Object.entries(mapping).filter(([_, target]) => Boolean(target));
    const classMap = new Map(classList.map((c) => [c.name.toLowerCase().replace(/\s+/g, ""), c.id]));

    return rawRows.slice(0, 5).map((row, index) => {
      const student: any = {
        id: `preview-${index}`,
        first_name: "",
        last_name: "",
        relationship: "father",
        review_flags: [],
        confidence: 0.95,
        status: "ready",
      };

      mappedEntries.forEach(([header, target]) => {
        const val = row[header];
        if (val !== undefined && val !== null) {
          if (target === "dob" && val instanceof Date) {
            student.dob = val.toISOString().slice(0, 10);
          } else if (target === "parent_phone") {
            student.parent_phone = normalizeNigerianPhone(String(val));
          } else if (target === "gender") {
            const g = String(val).toLowerCase();
            student.gender = g.startsWith("f") ? "female" : g.startsWith("m") ? "male" : undefined;
          } else {
            student[target] = String(val).trim();
          }
        }
      });

      if (student.class_name) {
        const matchId = classMap.get(student.class_name.toLowerCase().replace(/\s+/g, ""));
        if (matchId) student.class_applied_id = matchId;
      }

      return student;
    });
  }, [rawRows, mapping, classList]);

  const handleApply = () => {
    // Check required fields
    const mappedTargets = new Set(Object.values(mapping));
    const missingRequired = TARGET_FIELDS.filter((f) => f.required && !mappedTargets.has(f.key));

    if (missingRequired.length > 0) {
      toast.error(`Please map required field(s): ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    const classMap = new Map(classList.map((c) => [c.name.toLowerCase().replace(/\s+/g, ""), c.id]));
    const mappedStudents: ExtractedAdmissionStudent[] = rawRows.map((row, index) => {
      const student: ExtractedAdmissionStudent = {
        id: `spreadsheet-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
        first_name: "",
        last_name: "",
        relationship: "father",
        review_flags: [],
        confidence: 0.96,
        status: "ready",
        source_row: index + 2,
        source_snippet: `${fileName} (Row ${index + 2})`,
        is_selected: true,
      };

      Object.entries(mapping).forEach(([header, target]) => {
        if (!target) return;
        const val = row[header];
        if (val !== undefined && val !== null) {
          if (target === "dob") {
            student.dob = val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
          } else if (target === "parent_phone") {
            student.parent_phone = normalizeNigerianPhone(String(val));
          } else if (target === "gender") {
            const g = String(val).toLowerCase();
            student.gender = g.startsWith("f") ? "female" : g.startsWith("m") ? "male" : undefined;
          } else {
            (student as any)[target] = String(val).trim();
          }
        }
      });

      if (student.class_name) {
        const matchId = classMap.get(student.class_name.toLowerCase().replace(/\s+/g, ""));
        if (matchId) student.class_applied_id = matchId;
      }

      if (!student.first_name || !student.last_name) {
        student.review_flags.push("Missing required name");
        student.status = "needs_review";
      }

      return student;
    });

    toast.success(`Successfully mapped ${mappedStudents.length} student records from spreadsheet!`);
    onMapped(mappedStudents);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Map Spreadsheet Columns to Admission Fields
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            File: <span className="font-semibold text-foreground">{fileName}</span> ({rawRows.length} rows detected)
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Column Mapping Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center justify-between">
              <span>Column Mapping</span>
              <span className="text-xs font-normal text-muted-foreground">
                Matches spreadsheet headers to EduERP student fields
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {rawHeaders.map((header) => {
                const currentMapped = mapping[header] || "unmapped";
                const isMapped = currentMapped !== "unmapped";
                return (
                  <div
                    key={header}
                    className={`rounded-lg border p-3 text-xs transition ${
                      isMapped ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold truncate max-w-[150px]" title={header}>
                        {header}
                      </span>
                      {isMapped ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          Mapped
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Skip
                        </Badge>
                      )}
                    </div>

                    <Select
                      value={currentMapped}
                      onValueChange={(val) => updateMapping(header, val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select target field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">-- Skip this column --</SelectItem>
                        {TARGET_FIELDS.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label} {field.required ? "*" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Preview of first 5 mapped rows */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>Sample Row Preview (First 5 Rows)</span>
            </h3>
            <div className="rounded-lg border overflow-x-auto bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12 text-xs">#</TableHead>
                    <TableHead className="text-xs">Student Name</TableHead>
                    <TableHead className="text-xs">Gender</TableHead>
                    <TableHead className="text-xs">DOB</TableHead>
                    <TableHead className="text-xs">Class</TableHead>
                    <TableHead className="text-xs">Parent Name</TableHead>
                    <TableHead className="text-xs">Parent Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewStudents.map((st, i) => (
                    <TableRow key={i} className="text-xs">
                      <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        {st.first_name || st.last_name ? (
                          `${st.first_name} ${st.middle_name || ""} ${st.last_name}`
                        ) : (
                          <span className="text-muted-foreground italic">Name not mapped</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{st.gender || "—"}</TableCell>
                      <TableCell>{st.dob || "—"}</TableCell>
                      <TableCell>{st.class_name || "—"}</TableCell>
                      <TableCell>{st.parent_name || "—"}</TableCell>
                      <TableCell className="font-mono">{st.parent_phone || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center border-t pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="font-medium">
            <Check className="h-4 w-4 mr-1" />
            Import {rawRows.length} Students
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
