import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Search, User, ArrowRight, History, X, GraduationCap, Command } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StudentRecord {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string | null;
  photo_url: string | null;
  class_id: string | null;
  classes?: { id?: string; name?: string } | null;
}

const RECENT_KEY = "eduerp_recent_students";

function getRecentStudents(): { id: string; name: string; admission_no: string; className: string }[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentStudent(item: { id: string; name: string; admission_no: string; className: string }) {
  try {
    const list = getRecentStudents().filter((s) => s.id !== item.id);
    list.unshift(item);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    // ignore storage errors
  }
}

function clearRecentStudents() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Trigger button to embed in the top header bar or page tools.
 */
export function StudentSearchTrigger({
  onOpen,
  className,
}: {
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex h-9 w-full max-w-sm items-center justify-between rounded-lg border border-input bg-background/80 px-3 text-sm text-muted-foreground shadow-sm transition hover:border-ring/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label="Search students by name or admission number"
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground/80 transition-colors group-hover:text-foreground" />
        <span className="hidden sm:inline">Search students by name or ID…</span>
        <span className="inline sm:hidden">Search students…</span>
      </div>
      <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <Command className="h-3 w-3" />K
      </kbd>
    </button>
  );
}

/**
 * Persistent Student Search Command Dialog.
 * Listens to Cmd+K / Ctrl+K globally and allows instant navigation to student profiles.
 */
export function StudentSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { schoolId } = useAuth();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<ReturnType<typeof getRecentStudents>>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");

  // Load recent on open
  useEffect(() => {
    if (open) {
      setRecent(getRecentStudents());
      setQuery("");
    }
  }, [open]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const { data: students, isLoading } = useQuery({
    queryKey: ["persistent-student-search", schoolId],
    queryFn: async () => {
      const q = supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, middle_name, gender, photo_url, class_id, classes(id, name)")
        .order("first_name", { ascending: true });

      if (schoolId) {
        q.eq("school_id", schoolId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StudentRecord[];
    },
    enabled: open,
    staleTime: 1000 * 60 * 2, // cache for 2 minutes
  });

  // Extract unique classes for quick filter chips
  const classList = useMemo(() => {
    if (!students) return [];
    const map = new Map<string, string>();
    for (const s of students) {
      if (s.classes?.id && s.classes?.name) {
        map.set(s.classes.id, s.classes.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [students]);

  // Real-time filtering
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLowerCase();

    return students.filter((s) => {
      // Class filter
      if (selectedClass !== "all" && s.class_id !== selectedClass) {
        return false;
      }

      if (!q) return true;

      const fullName = `${s.first_name || ""} ${s.middle_name || ""} ${s.last_name || ""}`.toLowerCase();
      const adm = (s.admission_no || "").toLowerCase();
      const className = (s.classes?.name || "").toLowerCase();

      return fullName.includes(q) || adm.includes(q) || className.includes(q);
    });
  }, [students, query, selectedClass]);

  const handleSelectStudent = useCallback(
    (student: StudentRecord) => {
      const fullName = [student.first_name, student.last_name].filter(Boolean).join(" ");
      const className = student.classes?.name ?? "Unassigned";

      saveRecentStudent({
        id: student.id,
        name: fullName,
        admission_no: student.admission_no,
        className,
      });

      onOpenChange(false);
      navigate({ to: "/students/$id", params: { id: student.id } });
    },
    [navigate, onOpenChange]
  );

  const handleSelectRecent = useCallback(
    (rec: { id: string }) => {
      onOpenChange(false);
      navigate({ to: "/students/$id", params: { id: rec.id } });
    },
    [navigate, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col">
        <CommandInput
          placeholder="Search by student name or admission number (e.g. Aisha, DMA/001)…"
          value={query}
          onValueChange={setQuery}
        />

        {/* Quick class filter segments */}
        {classList.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-muted/20 px-3 py-2 text-xs">
            <span className="text-muted-foreground mr-1 text-[11px] font-medium shrink-0">Class:</span>
            <button
              type="button"
              onClick={() => setSelectedClass("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
                selectedClass === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All ({students?.length ?? 0})
            </button>
            {classList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClass(c.id === selectedClass ? "all" : c.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
                  selectedClass === c.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <CommandList className="max-h-[380px] p-2">
          {isLoading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading student directory…
            </div>
          )}

          {!isLoading && filteredStudents.length === 0 && (
            <CommandEmpty>
              <div className="py-6 text-center">
                <User className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">No students found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try checking the spelling or searching with a different admission number.
                </p>
              </div>
            </CommandEmpty>
          )}

          {/* Recent searches when query is empty */}
          {!query && recent.length > 0 && (
            <CommandGroup
              heading={
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <History className="h-3 w-3" /> Recent Profiles
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearRecentStudents();
                      setRecent([]);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              }
            >
              {recent.map((rec) => (
                <CommandItem
                  key={`recent-${rec.id}`}
                  onSelect={() => handleSelectRecent(rec)}
                  className="flex items-center justify-between py-2 px-3 rounded-md cursor-pointer hover:bg-accent/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {rec.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{rec.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">{rec.admission_no}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.className}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Main search results */}
          {filteredStudents.length > 0 && (
            <CommandGroup
              heading={
                query
                  ? `Search Results (${filteredStudents.length})`
                  : `All Students (${filteredStudents.length})`
              }
            >
              {filteredStudents.map((student) => {
                const fullName = [student.first_name, student.middle_name, student.last_name]
                  .filter(Boolean)
                  .join(" ");
                const className = student.classes?.name ?? "No class assigned";
                const initials = `${student.first_name?.charAt(0) || ""}${student.last_name?.charAt(0) || ""}`.toUpperCase();

                return (
                  <CommandItem
                    key={student.id}
                    value={`${fullName} ${student.admission_no} ${className}`}
                    onSelect={() => handleSelectStudent(student)}
                    className="flex items-center justify-between py-2.5 px-3 rounded-md cursor-pointer hover:bg-accent/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {student.photo_url ? (
                        <img
                          src={student.photo_url}
                          alt={fullName}
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 rounded-full object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {initials || <GraduationCap className="h-4 w-4" />}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums text-foreground/80 font-medium">
                            {student.admission_no}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{className}</span>
                          {student.gender && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{student.gender}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs text-primary font-medium hidden sm:inline-flex items-center gap-1 group-hover:underline">
                        Open <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>

        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground bg-muted/10">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-muted px-1 py-0.5 rounded border border-border">↑</kbd>{" "}
              <kbd className="font-mono bg-muted px-1 py-0.5 rounded border border-border">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="font-mono bg-muted px-1 py-0.5 rounded border border-border">↵</kbd> View Profile
            </span>
            <span>
              <kbd className="font-mono bg-muted px-1 py-0.5 rounded border border-border">esc</kbd> Close
            </span>
          </div>
          {filteredStudents.length > 0 && (
            <span className="font-mono tabular-nums">
              {filteredStudents.length} {filteredStudents.length === 1 ? "record" : "records"}
            </span>
          )}
        </div>
      </div>
    </CommandDialog>
  );
}
