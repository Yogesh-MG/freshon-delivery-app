/**
 * Dev-only audition page for the alert cues.
 *
 * Imports the REAL `@/lib/sound` module rather than reimplementing the tones, so
 * what you hear here is exactly what a rider hears in the field. Registered only
 * when `import.meta.env.DEV` is true — it never reaches a release bundle.
 *
 * Open at /sound-demo (http://localhost:8100/sound-demo).
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CheckCircle2, ScanLine, Volume2, VolumeX, XCircle, Zap } from "lucide-react";
import { Cue, isMuted, play, setMuted, startOfferAlert, unlockAudio } from "@/lib/sound";

interface CueRow {
  cue: Cue;
  label: string;
  icon: typeof Bell;
  when: string;
  sound: string;
  haptic: string;
}

const CUES: CueRow[] = [
  {
    cue: "offer",
    label: "New trip offer",
    icon: Bell,
    when: "trip_available / trip_released over the WebSocket",
    sound: "Rising A5→C#6→E6 arpeggio, played twice · triangle wave",
    haptic: "3 long pulses (220/220/380 ms)",
  },
  {
    cue: "success",
    label: "Success",
    icon: CheckCircle2,
    when: "Trip accepted, pickup confirmed, stop completed",
    sound: "Two-note lift C6→G6 · sine",
    haptic: "Single 40 ms tap",
  },
  {
    cue: "error",
    label: "Error",
    icon: XCircle,
    when: "Claim failed, upload failed, offline blocked",
    sound: "Descending 320→200 Hz buzz · sawtooth",
    haptic: "Double 120 ms buzz",
  },
  {
    cue: "scan",
    label: "QR scan accepted",
    icon: ScanLine,
    when: "Handover / bag QR read, before the network round-trip",
    sound: "2 kHz blip, 70 ms · square",
    haptic: "25 ms tick",
  },
  {
    cue: "tick",
    label: "UI acknowledgement",
    icon: Zap,
    when: "Map toggle, status change, trip cancelled",
    sound: "1.2 kHz blip, 40 ms · sine",
    haptic: "None",
  },
];

const SoundDemo = () => {
  const navigate = useNavigate();
  const [muted, setMutedState] = useState(isMuted);
  const [alerting, setAlerting] = useState(false);
  const [last, setLast] = useState<Cue | null>(null);
  const stopAlertRef = useRef<(() => void) | null>(null);

  // The AudioContext starts suspended until a gesture. Landing on this page is
  // usually preceded by one, but unlock again here so the very first button
  // press makes a sound instead of silently priming the context.
  useEffect(() => {
    void unlockAudio();
    return () => stopAlertRef.current?.();
  }, []);

  const fire = async (cue: Cue) => {
    await unlockAudio();
    play(cue);
    setLast(cue);
  };

  const toggleAlert = async () => {
    if (alerting) {
      stopAlertRef.current?.();
      stopAlertRef.current = null;
      setAlerting(false);
      return;
    }
    await unlockAudio();
    stopAlertRef.current = startOfferAlert();
    setAlerting(true);
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-card ring-1 ring-border"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Alert cue demo</h1>
            <p className="text-xs text-muted-foreground">Dev only · plays the real sound module</p>
          </div>
        </div>

        {/* Mute */}
        <div className="flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-center gap-3">
            {muted ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-primary" />}
            <div>
              <div className="text-sm font-bold text-foreground">{muted ? "Muted" : "Sound on"}</div>
              <div className="text-xs text-muted-foreground">
                {muted ? "Haptics still fire when muted" : "Same setting as Profile → Alert sounds"}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedState(next);
              if (!next) void fire("success");
            }}
            className="rounded-xl bg-muted px-3 py-2 text-xs font-bold text-foreground"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>

        {/* Cue list */}
        <div className="space-y-2">
          {CUES.map(({ cue, label, icon: Icon, when, sound, haptic }) => (
            <button
              key={cue}
              onClick={() => void fire(cue)}
              className={`w-full rounded-2xl bg-card p-4 text-left ring-1 transition-colors active:scale-[0.99] ${
                last === cue ? "ring-primary" : "ring-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-bold text-foreground">{label}</span>
                <code className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {cue}
                </code>
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <div><span className="font-semibold text-foreground/70">Fires on:</span> {when}</div>
                <div><span className="font-semibold text-foreground/70">Sound:</span> {sound}</div>
                <div><span className="font-semibold text-foreground/70">Haptic:</span> {haptic}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Repeating offer alert — the real one used while an offer is on screen */}
        <button
          onClick={() => void toggleAlert()}
          className={`w-full rounded-2xl px-5 py-4 text-sm font-bold transition-colors ${
            alerting
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {alerting ? "Stop repeating offer alert" : "Play repeating offer alert (every 3s)"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          This is what plays while an unanswered offer is on screen. In the app it
          stops on claim/dismiss, and self-caps after 30s.
        </p>

        <p className="rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
          Heard nothing? Browsers keep audio suspended until you interact with the
          page — tap any button once, then try again. Haptics only work on a real
          device, not a desktop browser.
        </p>
      </div>
    </div>
  );
};

export default SoundDemo;
