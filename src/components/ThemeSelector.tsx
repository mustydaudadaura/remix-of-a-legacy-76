import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { APP_THEMES, getStoredTheme, setStoredTheme, applyAppTheme, type AppTheme } from "@/lib/theme";
import { Check, Sparkles, Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

interface ThemeSelectorProps {
  schoolId: string;
  initialTheme?: string | null;
}

export function ThemeSelector({ schoolId, initialTheme }: ThemeSelectorProps) {
  const qc = useQueryClient();
  const [activeTheme, setActiveTheme] = useState<string>(() => getStoredTheme(initialTheme));
  const [selectedTheme, setSelectedTheme] = useState<string>(() => getStoredTheme(initialTheme));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = getStoredTheme(initialTheme);
    setActiveTheme(current);
    setSelectedTheme(current);
    applyAppTheme(current);
  }, [initialTheme]);

  // Preview theme immediately when clicking a card
  const handlePreviewTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    applyAppTheme(themeId);
  };

  // Revert back to the saved active theme
  const handleResetPreview = () => {
    setSelectedTheme(activeTheme);
    applyAppTheme(activeTheme);
  };

  // Persist theme choice to database and local storage
  const handleSaveTheme = async (themeToSave: string) => {
    setSaving(true);
    try {
      // 1. Persist locally immediately so changes take effect across the entire app
      setStoredTheme(themeToSave);
      setActiveTheme(themeToSave);
      setSelectedTheme(themeToSave);

      // 2. Persist to schools table in Supabase if schoolId is present
      if (schoolId) {
        try {
          await supabase
            .from("schools")
            .update({ theme_color: themeToSave })
            .eq("id", schoolId);
        } catch {
          // Local storage fallback already succeeded
        }
      }

      // Invalidate queries so school data updates
      await qc.invalidateQueries({ queryKey: ["school-settings", schoolId] });
      await qc.invalidateQueries({ queryKey: ["active-school"] });
      await qc.invalidateQueries({ queryKey: ["schools"] });

      const themeObj = APP_THEMES.find((t) => t.id === themeToSave);
      toast.success(`School appearance updated to ${themeObj?.name || themeToSave}!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save theme settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl border bg-card shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                School App Themes & Beautification
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  5 Curated Palettes
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Select an institutional theme to transform your school portal, navigation sidebar, buttons, and badges.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedTheme !== activeTheme && (
            <Button variant="outline" size="sm" onClick={handleResetPreview} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-1 text-muted-foreground" /> Revert Preview
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleSaveTheme(selectedTheme)}
            disabled={saving || selectedTheme === activeTheme}
            className="font-medium"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving…" : "Save as School Theme"}
          </Button>
        </div>
      </div>

      {/* 5 Theme Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {APP_THEMES.map((theme: AppTheme) => {
          const isSelected = selectedTheme === theme.id;
          const isCurrentActive = activeTheme === theme.id;

          return (
            <Card
              key={theme.id}
              onClick={() => handlePreviewTheme(theme.id)}
              className={`cursor-pointer transition-all duration-200 border-2 overflow-hidden hover:shadow-md ${
                isSelected
                  ? "border-primary ring-2 ring-primary/40 shadow-sm"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {/* Mini App UI Mockup Preview */}
              <div
                className="h-36 relative p-3 flex flex-col justify-between overflow-hidden text-white"
                style={{ background: theme.previewBg }}
              >
                {/* Mock UI Frame */}
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5 bg-black/35 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <span>{theme.name}</span>
                  </div>

                  {isCurrentActive && (
                    <Badge className="bg-white text-slate-950 font-bold text-[10px] shadow-sm">
                      Active
                    </Badge>
                  )}
                </div>

                {/* Mock Components Preview */}
                <div className="bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 shadow-lg border border-white/20 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] truncate">EduERP Nigeria</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white"
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

                {/* Decorative glow */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/20 blur-xl pointer-events-none" />
              </div>

              {/* Theme Details Body */}
              <CardContent className="p-4 space-y-3 bg-card">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-foreground">{theme.name}</h3>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {theme.tagline}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {theme.description}
                  </p>
                </div>

                {/* Color Swatch Circles */}
                <div className="flex items-center justify-between pt-1 border-t text-xs">
                  <span className="text-[11px] text-muted-foreground">Palette Swatches:</span>
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

                {/* Action Buttons */}
                <div className="pt-2">
                  {isCurrentActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-semibold bg-primary/5 text-primary border-primary/30"
                      disabled
                    >
                      <Check className="h-3.5 w-3.5 mr-1 text-primary" /> Active School Theme
                    </Button>
                  ) : isSelected ? (
                    <Button
                      size="sm"
                      className="w-full text-xs font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveTheme(theme.id);
                      }}
                      disabled={saving}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {saving ? "Applying…" : "Save Theme"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewTheme(theme.id);
                      }}
                    >
                      Preview Theme
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
