export type GeoFix = { lat: number; lng: number; accuracy: number };

/** Ask the browser for one high-accuracy GPS fix. Resolves null when unavailable or denied. */
export function getLocation(timeoutMs = 15000): Promise<{ fix: GeoFix | null; error?: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ fix: null, error: "This device cannot share its location." });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ fix: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) => resolve({ fix: null, error: e.code === 1 ? "Location permission was denied. Allow location for this site and try again." : "Could not get your location. Move to an open area and try again." }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
