import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, RefreshCw, Check, X, SwitchCamera, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (captures: Array<{ dataUrl: string; name: string }>) => void;
  title?: string;
  isPassportMode?: boolean;
}

export function CameraCaptureModal({
  open,
  onOpenChange,
  onCapture,
  title = "Capture Registration Sheet",
  isPassportMode = false,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(isPassportMode ? "user" : "environment");
  const [captures, setCaptures] = useState<string[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCaptures([]);
      setActivePreviewIndex(null);
      setCameraError(null);
    }
  }, [open, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: isPassportMode ? 1280 : 1920 },
          height: { ideal: isPassportMode ? 1280 : 1080 },
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser settings."
          : "Unable to access camera on this device. Please use file upload instead."
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally if front facing camera for natural mirror preview
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCaptures((prev) => [...prev, dataUrl]);
    setActivePreviewIndex(captures.length);
    toast.success(`Photo ${captures.length + 1} captured!`);
  };

  const removeCapture = (index: number) => {
    setCaptures((prev) => prev.filter((_, i) => i !== index));
    setActivePreviewIndex(null);
  };

  const handleConfirm = () => {
    if (!captures.length) {
      toast.error("Please take at least one photo before confirming.");
      return;
    }
    const results = captures.map((dataUrl, idx) => ({
      dataUrl,
      name: `camera_capture_${Date.now()}_page_${idx + 1}.jpg`,
    }));
    onCapture(results);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Camera className="h-5 w-5 text-primary" />
              {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCamera}
                title="Switch Camera (Front / Back)"
                disabled={!!cameraError}
              >
                <SwitchCamera className="h-4 w-4 mr-1" /> Switch
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="relative bg-slate-950 flex flex-col items-center justify-center min-h-[360px] sm:min-h-[440px]">
          {cameraError ? (
            <div className="p-6 text-center text-white max-w-md">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
              <p className="font-semibold text-lg mb-2">Camera Unavailable</p>
              <p className="text-sm text-slate-300 mb-4">{cameraError}</p>
              <Button variant="secondary" onClick={startCamera}>
                <RefreshCw className="h-4 w-4 mr-2" /> Try Again
              </Button>
            </div>
          ) : activePreviewIndex !== null && captures[activePreviewIndex] ? (
            // Preview selected photo
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              <img
                src={captures[activePreviewIndex]}
                alt="Captured document"
                className="max-h-[380px] rounded-lg border border-slate-700 object-contain shadow-2xl"
              />
              <div className="absolute top-6 right-6 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeCapture(activePreviewIndex)}
                >
                  <X className="h-4 w-4 mr-1" /> Retake / Delete
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setActivePreviewIndex(null)}
                >
                  Back to Camera
                </Button>
              </div>
            </div>
          ) : (
            // Live Video Stream
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full max-h-[440px] object-cover ${
                  facingMode === "user" ? "scale-x-[-1]" : ""
                }`}
              />

              {/* Document / Passport overlay guidelines */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {isPassportMode ? (
                  <div className="w-56 h-72 border-2 border-dashed border-primary/90 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center">
                    <span className="text-white text-xs bg-black/60 px-2 py-1 rounded font-medium">
                      Align Face Here
                    </span>
                  </div>
                ) : (
                  <div className="w-[88%] h-[82%] border-2 border-dashed border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-4">
                    <span className="text-white text-xs bg-black/60 px-3 py-1 rounded-full font-medium tracking-wide">
                      Position Document Inside Guide Frame
                    </span>
                    <div className="flex justify-between w-full text-[11px] text-white/80">
                      <span>Ensure good lighting</span>
                      <span>Keep text flat & steady</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Shutter Button */}
              <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="h-16 w-16 rounded-full bg-white border-4 border-primary p-1 shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                  aria-label="Capture Photo"
                >
                  <div className="h-full w-full rounded-full bg-primary" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Gallery thumbnails if multi-shot */}
        {captures.length > 0 && (
          <div className="p-3 bg-muted/40 border-t flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Captured ({captures.length}):
            </span>
            {captures.map((cap, i) => (
              <div
                key={i}
                onClick={() => setActivePreviewIndex(i)}
                className={`relative h-14 w-14 flex-shrink-0 cursor-pointer rounded border-2 overflow-hidden transition ${
                  activePreviewIndex === i ? "border-primary ring-2 ring-primary/40" : "border-border opacity-85 hover:opacity-100"
                }`}
              >
                <img src={cap} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 font-bold">
                  {i + 1}
                </span>
              </div>
            ))}
            {!isPassportMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActivePreviewIndex(null)}
                className="text-xs ml-auto whitespace-nowrap"
              >
                + Add Another Page
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="p-3 border-t bg-card flex sm:justify-between items-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleConfirm}
              disabled={captures.length === 0}
              className="font-medium"
            >
              <Check className="h-4 w-4 mr-1" />
              Use {captures.length} {captures.length === 1 ? "Photo" : "Photos"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
