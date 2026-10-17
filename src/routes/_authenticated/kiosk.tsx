import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { kioskIdentify, kioskPunch } from "@/lib/api/staff-attendance.functions";
import { getLocation } from "@/lib/geo-client";
import { fmtTime } from "@/lib/staff-attendance";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Delete, XCircle, MapPin, ShieldAlert, Navigation, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kiosk")({
  head: () => ({ meta: [
    { title: "Attendance Kiosk — Alegacy" },
    { name: "description", content: "Shared tablet kiosk where staff check in and out with a 4-digit PIN." },
    { property: "og:title", content: "Attendance Kiosk — Alegacy" },
    { property: "og:description", content: "PIN-based staff attendance kiosk for schools." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: KioskPage,
});

type Who = { name: string; photo: string | null; check_in_at: string | null; check_out_at: string | null; status: string | null };

function KioskPage() {
  const { schoolId } = useAuth();
  const identify = useServerFn(kioskIdentify);
  const punch = useServerFn(kioskPunch);
  const [pin, setPin] = useState("");
  const [who, setWho] = useState<Who | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => { setPin(""); setWho(null); setMsg(null); };
  const autoReset = (ms = 8000) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(reset, ms); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!schoolId) return <p className="text-muted-foreground">Select a school first.</p>;

  const press = async (d: string) => {
    if (busy || who) return;
    const next = (pin + d).slice(0, 4); setPin(next); setMsg(null);
    if (next.length === 4) {
      setBusy(true);
      try { setWho(await identify({ data: { school_id: schoolId, pin: next } })); autoReset(20000); }
      catch (e) { setMsg({ ok: false, text: (e as Error).message }); setPin(""); autoReset(4000); }
      finally { setBusy(false); }
    }
  };
  const act = async (action: "in" | "out") => {
    if (!navigator.onLine) { setMsg({ ok: false, text: "No internet connection. Nothing was recorded." }); return; }
    setBusy(true);
    try {
      const loc = await getLocation(8000);
      const r = await punch({ data: { school_id: schoolId, pin, action, lat: loc.fix?.lat ?? null, lng: loc.fix?.lng ?? null, accuracy: loc.fix?.accuracy ?? null } });
      const label = action === "in" ? "Check-in" : "Check-out";
      setMsg({ ok: true, text: r.already ? `${label} already recorded at ${fmtTime(r.time)}` : `${label} successful at ${fmtTime(r.time)}` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); autoReset(6000); }
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col items-center justify-center gap-5 text-center">
      {/* Geofence protection indicator */}
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
        <span>School Geolocation Geofencing Active</span>
      </div>

      {!who ? <>
        <div>
          <h1 className="text-3xl font-bold">Staff Attendance Kiosk</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Check in/out within school premises. Non-premises attempts are strictly denied.
          </p>
        </div>
        <p className="text-sm font-semibold text-foreground">Enter your 4-digit Staff PIN</p>
        <div className="flex gap-3" aria-label="PIN entered">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-5 w-5 rounded-full border-2 border-primary ${pin.length > i ? "bg-primary" : ""}`} />)}</div>
        <div className="grid w-full grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Button key={d} variant="outline" className="h-20 text-3xl font-mono shadow-sm" onClick={() => press(d)} disabled={busy}>{d}</Button>)}
          <Button variant="ghost" className="h-20 text-sm font-semibold" onClick={reset}>Clear</Button>
          <Button variant="outline" className="h-20 text-3xl font-mono shadow-sm" onClick={() => press("0")} disabled={busy}>0</Button>
          <Button variant="ghost" className="h-20" aria-label="Delete" onClick={() => setPin(pin.slice(0, -1))}><Delete /></Button>
        </div>
      </> : <>
        {who.photo ? <img src={who.photo} alt="" className="h-28 w-28 rounded-full object-cover border-2 border-primary shadow" /> : <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-4xl font-bold text-primary-foreground shadow">{who.name.slice(0, 1)}</div>}
        <div>
          <h1 className="text-2xl font-bold uppercase">{who.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Today: in {fmtTime(who.check_in_at)} · out {fmtTime(who.check_out_at)}</p>
        </div>
        {!msg?.ok && (!who.check_in_at
          ? <Button className="h-20 w-full text-2xl font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy} onClick={() => act("in")}>CHECK IN</Button>
          : !who.check_out_at ? <Button className="h-20 w-full text-2xl font-bold shadow-md bg-amber-600 hover:bg-amber-700 text-white" disabled={busy} onClick={() => act("out")}>CHECK OUT</Button>
          : <p className="text-base font-semibold text-emerald-600">Attendance complete for today.</p>)}
        <Button variant="ghost" size="sm" onClick={reset}>Done</Button>
      </>}
      {msg && <div role="status" className={`flex items-center gap-2 rounded-lg border p-3.5 text-sm font-medium ${msg.ok ? "border-emerald-500 bg-emerald-50/50 text-emerald-800 dark:text-emerald-200" : "border-destructive bg-destructive/10 text-destructive"}`}>{msg.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />}{msg.text}</div>}
    </div>
  );
}
