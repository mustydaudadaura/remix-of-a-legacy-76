import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Check,
  Palette,
  Sparkles,
  School,
  RotateCcw,
  Save,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  PREDEFINED_THEMES,
  THEME_STORAGE_KEY,
  type ThemeOption,
  type PredefinedThemeId,
} from "@/lib/theme";

export { PREDEFINED_THEMES };
export type { ThemeOption, PredefinedThemeId };

export interface SettingsProps {
  schoolId?: string | null;
  initialTheme?: string | null;
  onThemeChange?: (themeName: string) => void;
  className?: string;
}

function resolveCurrentTheme(initialTheme?: string | null): PredefinedThemeId {
  if (typeof document !== "undefined") {
    const docAttr = document.documentElement.getAttribute("data-theme");
    if (docAttr === "emerald" || docAttr === "sapphire" || docAttr === "amber" || docAttr === "amethyst") {
      return docAttr;
    }
    if (docAttr === "default" || docAttr === "royal") return "default";
  }
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "emerald" || stored === "sapphire" || stored === "amber" || stored === "amethyst") {
      return stored;
    }
    if (stored === "default" || stored === "royal") return "default";
  }
  if (initialTheme === "emerald" || initialTheme === "sapphire" || initialTheme === "amber" || initialTheme === "amethyst") {
    return initialTheme;
  }
  return "default";
}

/**
 * Settings component provides a dedicated UI to toggle between the 5 pre-defined
 * CSS themes (default, emerald, sapphire, amber, amethyst) using
 * document.documentElement.setAttribute('data-theme', themeName).
 */
export function Settings({
  schoolId,
  initialTheme,
  onThemeChange,
  className = "",
}: SettingsProps) {
  const qc = useQueryClient();
  const [currentTheme, setCurrentTheme] = useState<PredefinedThemeId>(() => resolveCurrentTheme(initialTheme));
  const [saving, setSaving] = useState(false);

  // Synchronize on mount and initialTheme change
  useEffect(() => {
    setCurrentTheme(resolveCurrentTheme(initialTheme));
  }, [initialTheme]);

  /**
   * Directly toggle theme using document.documentElement.setAttribute('data-theme', themeName)
   */
  const handleToggleTheme = (themeName: ThemeOption["id"]) => {
    if (typeof document !== "undefined") {
      // Toggle theme via document.documentElement.setAttribute('data-theme', themeName)
      document.documentElement.setAttribute("data-theme", themeName);
      window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme: themeName } }));
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, themeName);
    }

    setCurrentTheme(themeName);
    onThemeChange?.(themeName);

    const match = PREDEFINED_THEMES.find((t) => t.id === themeName);
    toast.success(`Active theme changed to ${match?.name || themeName}`);
  };

  /**
   * Save theme as default school setting
   */
  const handleSaveSchoolTheme = async (themeToSave: ThemeOption["id"]) => {
    setSaving(true);
    try {
      // 1. Immediately toggle attribute on document
      handleToggleTheme(themeToSave);

      // 2. Persist to database if schoolId is configured
      if (schoolId) {
        try {
          await supabase
            .from("schools")
            .update({ theme_color: themeToSave })
            .eq("id", schoolId);
        } catch {
          // Graceful fallback when working in preview or offline
        }
      }

      await qc.invalidateQueries({ queryKey: ["school-settings", schoolId] });
      await qc.invalidateQueries({ queryKey: ["active-school"] });
      await qc.invalidateQueries({ queryKey: ["schools"] });

      const match = PREDEFINED_THEMES.find((t) => t.id === themeToSave);
      toast.success(`Saved ${match?.name} as the official school theme!`);
    } catch {
      toast.error("Failed to persist theme to school record.");
    } finally {
      setSaving(false);
    }
  };

  const activeThemeObj = PREDEFINED_THEMES.find((t) => t.id === currentTheme) || PREDEFINED_THEMES[0];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  School Appearance & Theme Settings
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    5 Palettes
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Toggle institutional branding to beautify school dashboard, portal, badges, and navigation.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleTheme("default")}
                disabled={currentTheme === "default"}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                Reset to Default
              </Button>
              <Button
                size="sm"
                onClick={() => handleSaveSchoolTheme(currentTheme)}
                disabled={saving}
                className="font-medium shadow-xs"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Saving…" : "Save for School"}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Quick Horizontal Toggle Bar */}
        <CardContent className="p-4 bg-card">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Theme Toggle:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {PREDEFINED_THEMES.map((theme) => {
                const isActive = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleToggleTheme(theme.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30"
                        : "bg-background hover:bg-muted text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-white/30 shadow-xs"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <span>{theme.name}</span>
                    {isActive && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid of 5 Theme Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PREDEFINED_THEMES.map((theme) => {
          const isActive = currentTheme === theme.id;

          return (
            <Card
              key={theme.id}
              onClick={() => handleToggleTheme(theme.id)}
              className={`cursor-pointer transition-all duration-200 border-2 overflow-hidden hover:shadow-md ${
                isActive
                  ? "border-primary ring-2 ring-primary/40 shadow-sm"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {/* Header Mini App Preview */}
              <div
                className="h-36 relative p-3.5 flex flex-col justify-between overflow-hidden text-white"
                style={{ background: theme.previewBg }}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                    <span
                      className="h-2 w-2 rounded-full ring-1 ring-white/50"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <span>{theme.tagline}</span>
                  </div>

                  {isActive && (
                    <Badge className="bg-white text-slate-950 font-bold text-[10px] shadow-sm flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Active
                    </Badge>
                  )}
                </div>

                {/* Mock Educational Card */}
                <div className="bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 shadow-lg border border-white/20 text-xs space-y-1.5 backdrop-blur-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] truncate flex items-center gap-1">
                      <School className="h-3 w-3 text-primary" />
                      Result Arena Workspace
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white shadow-xs"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      {theme.badgeText}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>Admissions · Students · Results</span>
                  </div>
                </div>

                <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-white/20 blur-xl pointer-events-none" />
              </div>

              {/* Theme Details */}
              <CardContent className="p-4 space-y-3 bg-card">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-foreground">{theme.name}</h3>
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                      data-theme=&quot;{theme.id}&quot;
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {theme.description}
                  </p>
                </div>

                {/* Color Swatch Circles */}
                <div className="flex items-center justify-between pt-1 border-t text-xs">
                  <span className="text-[11px] text-muted-foreground">Color Swatches:</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-5 w-5 rounded-full border shadow-xs"
                      style={{ backgroundColor: theme.primaryColor }}
                      title="Primary Brand Color"
                    />
                    <div
                      className="h-5 w-5 rounded-full border shadow-xs"
                      style={{ backgroundColor: theme.accentColor }}
                      title="Accent Color"
                    />
                    <div
                      className="h-5 w-5 rounded-full border shadow-xs"
                      style={{ backgroundColor: theme.sidebarColor }}
                      title="Sidebar Tone"
                    />
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  {isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-semibold bg-primary/5 text-primary border-primary/30"
                      disabled
                    >
                      <Check className="h-3.5 w-3.5 mr-1 text-primary" /> Active Theme
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTheme(theme.id);
                      }}
                    >
                      Toggle to {theme.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live School Settings Preview Section to Find Changes */}
      <Card className="border shadow-sm bg-card overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Live Theme Preview: Changes Applied Across School Interface
          </CardTitle>
          <CardDescription className="text-xs">
            Notice how selecting <strong className="text-foreground">{activeThemeObj.name}</strong> instantly restyles your school buttons, badges, navigation indicators, and cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-card/60 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Primary Brand Buttons
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Primary Action</Button>
                <Button size="sm" variant="secondary">Secondary</Button>
                <Button size="sm" variant="outline">Outline</Button>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-card/60 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Badges & Indicators
              </span>
              <div className="flex flex-wrap gap-2">
                <Badge>Enrolled</Badge>
                <Badge variant="secondary">Active Session</Badge>
                <Badge variant="outline">Term 1</Badge>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-card/60 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Active Theme Token
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-lg shadow-sm border"
                  style={{ backgroundColor: activeThemeObj.primaryColor }}
                />
                <div className="text-xs">
                  <div className="font-semibold text-foreground">{activeThemeObj.name}</div>
                  <div className="text-[10px] text-muted-foreground">data-theme=&quot;{activeThemeObj.id}&quot;</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
