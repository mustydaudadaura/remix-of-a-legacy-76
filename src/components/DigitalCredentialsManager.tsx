import React, { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Stamp,
  PenTool,
  Upload,
  Save,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Trash2,
  FileCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

interface DigitalCredentialsManagerProps {
  school: {
    id: string;
    name: string;
    stamp_url?: string | null;
    principal_signature_url?: string | null;
    principal_name?: string | null;
    logo_url?: string | null;
    [key: string]: any;
  };
}

export function DigitalCredentialsManager({ school }: DigitalCredentialsManagerProps) {
  const qc = useQueryClient();
  const [stampUrl, setStampUrl] = useState<string>(school.stamp_url || "");
  const [signatureUrl, setSignatureUrl] = useState<string>(school.principal_signature_url || "");
  const [logoUrl, setLogoUrl] = useState<string>(school.logo_url || "");
  const [principalName, setPrincipalName] = useState<string>(school.principal_name || "Principal");
  const [busy, setBusy] = useState(false);
  const [sampleQrUrl, setSampleQrUrl] = useState("");

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/verify-credential?token=OFFICIAL-SAMPLE`;
      QRCode.toDataURL(url, { width: 120, margin: 1 }).then(setSampleQrUrl).catch(() => {});
    }
  }, []);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e3a8a"; // Classic blue fountain ink
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      setSignatureUrl(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSignatureUrl("");
  };

  // Convert uploaded image file to Data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "stamp" | "signature" | "logo") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be under 2 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (target === "stamp") setStampUrl(res);
      if (target === "signature") setSignatureUrl(res);
      if (target === "logo") setLogoUrl(res);
      toast.success(`${target.toUpperCase()} uploaded successfully`);
    };
    reader.readAsDataURL(file);
  };

  // Preset Generator: Generate Official Circular Nigerian School Rubber Stamp
  const generateOfficialRubberStamp = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 300, 300);

    const centerX = 150;
    const centerY = 150;
    const radius = 130;
    const color = "#991b1b"; // Classic Nigerian deep red/carmine rubber stamp

    // Outer double circle
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 8, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 42, 0, Math.PI * 2);
    ctx.stroke();

    // Curved Text on top: School Name
    ctx.fillStyle = color;
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const schoolTitle = (school.name || "RESULT ARENA ACADEMY").toUpperCase();
    drawCircularText(ctx, schoolTitle, centerX, centerY, radius - 24, -Math.PI * 0.75, Math.PI * 0.75);

    // Curved Text on bottom: OFFICIAL SEAL
    drawCircularTextBottom(ctx, "★ APPROVED & CERTIFIED ★", centerX, centerY, radius - 24);

    // Center Details
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("OFFICIAL", centerX, centerY - 16);
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("SEAL", centerX, centerY + 4);

    const year = new Date().getFullYear();
    ctx.font = "11px sans-serif";
    ctx.fillText(`EST. ${year}`, centerX, centerY + 22);

    const stampData = canvas.toDataURL("image/png");
    setStampUrl(stampData);
    toast.success("Generated authentic circular Nigerian rubber stamp!");
  };

  // Helper: draw text along top arc
  function drawCircularText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) {
    const angleRange = endAngle - startAngle;
    const step = angleRange / Math.max(1, text.length - 1);
    for (let i = 0; i < text.length; i++) {
      const angle = startAngle + i * step;
      ctx.save();
      ctx.translate(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
  }

  // Helper: draw text along bottom arc
  function drawCircularTextBottom(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    radius: number
  ) {
    const step = 0.12;
    const startAngle = Math.PI / 2 - ((text.length - 1) * step) / 2;
    for (let i = 0; i < text.length; i++) {
      const angle = startAngle + i * step;
      ctx.save();
      ctx.translate(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
      ctx.rotate(angle - Math.PI / 2);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
  }

  // Save all credentials
  const handleSave = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          stamp_url: stampUrl || null,
          principal_signature_url: signatureUrl || null,
          principal_name: principalName.trim() || null,
          logo_url: logoUrl || null,
        })
        .eq("id", school.id);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["school-settings", school.id] });
      await qc.invalidateQueries({ queryKey: ["report-card"] });
      await qc.invalidateQueries({ queryKey: ["portal-rc-detail"] });
      await qc.invalidateQueries({ queryKey: ["schools"] });

      toast.success("Digital stamp and principal signature saved successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save digital credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Stamp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Digital School Stamp &amp; Principal Signature
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    Anti-Tamper
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configure high-resolution digital rubber stamps and authentic handwritten signatures rendered on all report cards.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={busy} className="font-semibold shadow-xs">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {busy ? "Saving…" : "Save Credentials"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 1. Official School Stamp */}
            <div className="rounded-xl border p-5 space-y-4 bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Stamp className="h-4 w-4 text-primary" />
                    Official Digital Rubber Stamp
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rendered semi-transparently at the footer of official report cards.
                  </p>
                </div>
                {stampUrl && (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
                )}
              </div>

              {/* Stamp Preview */}
              <div className="flex items-center justify-center p-4 rounded-xl border border-dashed bg-muted/20 min-h-[160px] relative">
                {stampUrl ? (
                  <div className="relative group">
                    <img
                      src={stampUrl}
                      alt="Digital Stamp"
                      className="h-32 w-32 object-contain drop-shadow-sm"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7 absolute -top-2 -right-2 opacity-80 hover:opacity-100"
                      onClick={() => setStampUrl("")}
                      title="Remove stamp"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-1 text-muted-foreground">
                    <Stamp className="h-10 w-10 mx-auto opacity-30" />
                    <p className="text-xs">No digital rubber stamp configured</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateOfficialRubberStamp}
                  className="text-xs h-8 flex-1"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Generate Stamp Preset
                </Button>

                <Label
                  htmlFor="stamp-upload"
                  className="cursor-pointer inline-flex items-center justify-center gap-1.5 text-xs h-8 px-3 rounded-md border border-input bg-background hover:bg-muted font-medium transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Stamp PNG
                </Label>
                <Input
                  id="stamp-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "stamp")}
                />
              </div>
            </div>

            {/* 2. Principal Signature Pad */}
            <div className="rounded-xl border p-5 space-y-4 bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-primary" />
                    Principal / Head of School Signature
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Draw with mouse/touchscreen or upload transparent PNG.
                  </p>
                </div>
                {signatureUrl && (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
                )}
              </div>

              {/* Principal Name Input */}
              <div className="space-y-1">
                <Label className="text-xs">Principal / Signatory Name</Label>
                <Input
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="e.g. Dr. Aliyu Mohammed (FIMC)"
                  className="h-8 text-xs font-medium"
                />
              </div>

              {/* Interactive Canvas Signature Pad */}
              <div className="rounded-xl border border-dashed bg-white p-2 text-center relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={110}
                  className="w-full h-[110px] touch-none cursor-crosshair bg-white"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasDrawn && !signatureUrl && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none select-none">
                    ✍ Sign here using your mouse or touchscreen
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearCanvas}
                  className="text-xs h-8 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Clear Signature
                </Button>

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="sig-upload"
                    className="cursor-pointer inline-flex items-center justify-center gap-1.5 text-xs h-8 px-3 rounded-md border border-input bg-background hover:bg-muted font-medium transition"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Image
                  </Label>
                  <Input
                    id="sig-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "signature")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Document Footer Preview */}
          <div className="border-t pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" />
                  Live Printed Document Sign-off Preview
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How this digital stamp, signature, and verification QR code render on printable report cards.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                Verified Output
              </Badge>
            </div>

            <div className="rounded-xl border-2 border-primary/20 bg-muted/10 p-6 relative overflow-hidden">
              <div className="grid grid-cols-3 gap-6 items-end text-center text-xs">
                {/* 1. Teacher Signature Column */}
                <div>
                  <div className="h-12 border-b border-dotted border-border flex items-end justify-center pb-1">
                    <span className="font-script text-muted-foreground italic text-xs">Class Teacher</span>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Class Teacher's Signature
                  </span>
                </div>

                {/* 2. Principal Signature Column */}
                <div className="relative">
                  <div className="h-12 border-b border-dotted border-border flex items-end justify-center pb-1">
                    {signatureUrl ? (
                      <img src={signatureUrl} alt="Signature" className="h-11 object-contain" />
                    ) : (
                      <span className="font-script text-primary italic text-xs">Principal Sign-off</span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-foreground mt-1 block">
                    {principalName || "Principal"}
                  </span>
                </div>

                {/* 3. Anti-Tamper Verification QR Code Column */}
                <div>
                  {sampleQrUrl ? (
                    <img src={sampleQrUrl} alt="QR Code" className="h-16 w-16 mx-auto border rounded p-1 bg-white" />
                  ) : (
                    <div className="h-16 w-16 mx-auto bg-muted rounded border" />
                  )}
                  <span className="text-[10px] font-mono font-bold text-primary flex items-center justify-center gap-1 mt-1">
                    <ShieldCheck className="h-3 w-3" />
                    Scan to Verify
                  </span>
                </div>
              </div>

              {/* Watermarked Rubber Stamp Overlay */}
              {stampUrl && (
                <img
                  src={stampUrl}
                  alt="Rubber Stamp"
                  className="absolute right-12 bottom-4 h-24 w-24 object-contain opacity-85 pointer-events-none"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
