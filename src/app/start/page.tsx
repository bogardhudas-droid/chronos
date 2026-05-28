"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import coreApi from "@/utils/coreApi";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

type RestCategory = "hydration" | "nutrition" | "skincare" | "recovery" | "mindfulness";
type Priority = "high" | "medium" | "low";

interface TimePeriod {
  id: string;
  label: string;
  hours: [number, number];
  color: string;
  bg: string;
  accent: string;
  desc: string;
}

interface RestItem {
  id: string;
  text: string;
  category: RestCategory;
  priority: Priority;
  meta: string;
  nextIn: number;       // minutes until repeat
  completed: boolean;
  nextAt: string | null; // ISO timestamp when to do again
}

interface HistoryEntry {
  text: string;
  cat: RestCategory;
  completedAt: string;
  nextIn: number;
}

interface StoredData {
  items: RestItem[];
  history: HistoryEntry[];
  date: string;
  lastGen: string;
}

interface NextBeat {
  label:    string;
  secsLeft: number;
  color:    string;
  icon:     string;
}

interface CatMeta {
  label: string;
  color: string;
  icon: string;
}

// Extend window with the artifact storage API
declare global {
  interface Window {
    storage?: {
      get(key: string): Promise<{ key: string; value: string } | null>;
      set(key: string, value: string): Promise<unknown>;
      delete(key: string): Promise<unknown>;
    };
  }
}

// Anthropic API response shape (minimal)
interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

// Raw shape coming back from the model before validation
interface RawItem {
  id?: unknown;
  text?: unknown;
  category?: unknown;
  priority?: unknown;
  meta?: unknown;
  nextIn?: unknown;
  completed?: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_PERIODS: TimePeriod[] = [
  { id: "dawn", label: "Dawn", hours: [5, 7], color: "#fb923c", bg: "#0d0600", accent: "#fed7aa", desc: "Gentle awakening & gut reset" },
  { id: "morning", label: "Morning", hours: [7, 10], color: "#fbbf24", bg: "#0d0b00", accent: "#fde68a", desc: "Shield & activate your body" },
  { id: "midday", label: "Midday", hours: [10, 14], color: "#38bdf8", bg: "#00090f", accent: "#bae6fd", desc: "Sustain performance & hydrate" },
  { id: "afternoon", label: "Afternoon", hours: [14, 17], color: "#a78bfa", bg: "#07040f", accent: "#ddd6fe", desc: "Recharge & prevent fatigue" },
  { id: "evening", label: "Evening", hours: [17, 21], color: "#f472b6", bg: "#0f0009", accent: "#fbcfe8", desc: "Wind down & skin repair" },
  { id: "night", label: "Night", hours: [21, 24], color: "#818cf8", bg: "#03030f", accent: "#c7d2fe", desc: "Deep recovery preparation" },
  { id: "midnight", label: "Late Night", hours: [0, 5], color: "#6366f1", bg: "#020208", accent: "#a5b4fc", desc: "Maximum cellular restoration" },
];

const CAT_META: Record<RestCategory, CatMeta> = {
  hydration: { label: "Hydration", color: "#38bdf8", icon: "💧" },
  nutrition: { label: "Nutrition", color: "#fb923c", icon: "🥗" },
  skincare: { label: "Self-Care & Body", color: "#f472b6", icon: "✨" },
  recovery: { label: "Recovery", color: "#4ade80", icon: "🫁" },
  mindfulness: { label: "Mindfulness", color: "#c084fc", icon: "🧘" },
};

const CATEGORIES: RestCategory[] = ["hydration", "nutrition", "skincare", "recovery", "mindfulness"];

const VALID_CATEGORIES = new Set<string>(CATEGORIES);
const VALID_PRIORITIES = new Set<string>(["high", "medium", "low"]);

const STORAGE_KEY = "restore-ai-v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriod(hour: number): TimePeriod {
  return (
    TIME_PERIODS.find((p) =>
      p.hours[0] < p.hours[1]
        ? hour >= p.hours[0] && hour < p.hours[1]
        : hour >= p.hours[0] || hour < p.hours[1]
    ) ?? TIME_PERIODS[6]
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return "now";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestoreAI() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const [items, setItems] = useState<RestItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [period, setPeriod] = useState<TimePeriod>(() => getPeriod(new Date().getHours()));
  const [lastGen, setLastGen] = useState<string>("");
  const [nextBeats, setNextBeats] = useState<NextBeat[]>([]);

  // ── Persist ──
  const persist = useCallback((newItems: RestItem[], newHistory: HistoryEntry[]): void => {
    try {
      const payload: StoredData = {
        items: newItems,
        history: newHistory,
        date: new Date().toDateString(),
        lastGen: fmtTime(new Date()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // silently ignore
    }
  }, []);

  // ── Load from storage ──
  useEffect(() => {
    void (async () => {
      try {
        const res = await localStorage.getItem(STORAGE_KEY);
        if (!res) return;
        const data = JSON.parse(res) as StoredData;
        if (data.date === new Date().toDateString()) {
          setItems(data.items ?? []);
          setHistory(data.history ?? []);
          setLastGen(data.lastGen ?? "");
        }
      } catch {
        // silently ignore
      }
    })();
  }, []);

  // ── Live clock + period ──
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNow(n);
      setPeriod(getPeriod(n.getHours()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Next-rest countdown ──
  // ── Next-rest countdown (all completed items) ──
  useEffect(() => {
    const beats: NextBeat[] = items
      .filter((i) => i.completed && i.nextAt !== null)
      .map((i) => ({
        label: i.text.slice(0, 48),
        secsLeft: Math.max(0, Math.round((new Date(i.nextAt!).getTime() - Date.now()) / 1000)),
        color: CAT_META[i.category].color,
        icon: CAT_META[i.category].icon,
      }))
      .sort((a, b) => a.secsLeft - b.secsLeft);
    setNextBeats(beats);
  }, [items, now]);

  // ── Three.js background ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5.5;

    const col = new THREE.Color(period.color);
    const accent = new THREE.Color(period.accent);

    const outerMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 4),
      new THREE.MeshPhongMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.09 })
    );
    scene.add(outerMesh);

    const innerMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.4, 2),
      new THREE.MeshPhongMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.06 })
    );
    scene.add(innerMesh);

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.007, 8, 120),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25 })
    );
    torus.rotation.x = Math.PI / 3;
    scene.add(torus);

    const count = 250;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 22;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: col, size: 0.022, transparent: true, opacity: 0.5 })
    );
    scene.add(points);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pl = new THREE.PointLight(col, 2.5, 12);
    pl.position.set(4, 3, 4);
    scene.add(pl);

    let t = 0;
    const animate = (): void => {
      rafRef.current = requestAnimationFrame(animate);
      t += 0.004;
      outerMesh.rotation.x = t * 0.25;
      outerMesh.rotation.y = t * 0.45;
      innerMesh.rotation.x = -t * 0.35;
      innerMesh.rotation.y = t * 0.6;
      torus.rotation.z = t * 0.15;
      points.rotation.y = t * 0.04;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = (): void => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, [period.color, period.accent]);

  // ── Generate rest plan ──
  const generate = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const timeStr = fmtTime(now);
      const recentDone = history
        .slice(-8)
        .map((h) => `${h.cat}: "${h.text}" at ${h.completedAt}`)
        .join("\n") || "Nothing logged yet today.";

      const systemPrompt = `You are Chronos, an elite recovery AI trained in sports science, dermatology, nutrition, and neuroscience.
Your mission: help the user achieve peak physiological recovery so they can perform at the highest level.
Assume that everytime user generate a plan, they have just finished working and are ready to rest, based on prev rest history, decide whether to let user rest long or short based on optimal effectiveness.
Current time: ${timeStr}. Time period: ${period.label} (${period.desc}).
Today's completed recovery actions (DO NOT repeat these, build on them):
${recentDone}
Return ONLY a raw JSON array. No markdown. No explanation. No backticks.`;

      const userPrompt = `Generate an optimal REST & RECOVERY plan for ${period.label} (${timeStr}).

Rules:
- 6–8 items total spread across categories
- hydration: sip water every 20 mins, electrolytes if sweating, no back-to-back same hydration items
- nutrition: probiotics on empty stomach only in morning/dawn, meals with 40% lean protein / 30% complex carbs / 30% healthy fat / minimal sugar and oil, gut health focus
- skincare: include no tools no space exercise for midday (MTh vo2 max, TF cardio zone 2, WS strength exercise), morning = gentle cleanser → vitamin C serum → sunscreen SPF50; evening = cleanse → retinoid (only if evening) → ceramide moisturizer; always = eye cream, lip balm
- recovery: elevated legs rest, posture reset, eye rest 20-20-20 rule, micro-stretches, diaphragmatic breathing, cold/warm water face splash
- mindfulness: NSDR (non-sleep deep rest 10–20 min), psychological sigh (2 inhales nose + 1 long exhale), box breathing, body scan
Must do this at least N-times in history:
(once a day): exercise, take vitamins/supplements, drink probiotics
(2–3 times a day): face care, toothbrush
(3–5 times a day): meals

Each item JSON shape:
{
  "id": "unique 4-char string",
  "text": "Short action with specific detail (emoji and and number of order of which to start first) (what time to do this rest)",
  "category": "hydration" | "nutrition" | "skincare" | "recovery" | "mindfulness",
  "priority": "high" | "medium" | "low",
  "meta": "⏱ What time to do this rest and until when · 📍 location hint",
  "nextIn": <minutes until this should be done again, integer>,
  "completed": false
}

Only raw JSON array. Nothing else.`;

      const resp = await coreApi.generateTxt(userPrompt, systemPrompt);

      const clean = resp?.replace(/```json|```/g, "").trim();
      const s = clean.indexOf("[");
      const e = clean.lastIndexOf("]");
      const parsed = JSON.parse(s !== -1 ? clean.slice(s, e + 1) : clean) as RawItem[];

      const newItems: RestItem[] = parsed.map((it) => ({
        id: typeof it.id === "string" ? it.id : Math.random().toString(36).slice(2, 6),
        text: typeof it.text === "string" ? it.text : "Rest action",
        category: (typeof it.category === "string" && VALID_CATEGORIES.has(it.category)
          ? it.category : "recovery") as RestCategory,
        priority: (typeof it.priority === "string" && VALID_PRIORITIES.has(it.priority)
          ? it.priority : "medium") as Priority,
        meta: typeof it.meta === "string" ? it.meta : "",
        nextIn: typeof it.nextIn === "number" ? it.nextIn : 30,
        completed: false,
        nextAt: null,
      }));

      setItems(newItems);
      setLastGen(fmtTime(new Date()));
      persist(newItems, history);
    } catch {
      setError("Could not generate your rest plan. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [now, period, history, persist]);

  // ── Toggle ──
  const toggle = useCallback((id: string): void => {
    setItems((prev) => {
      const updated = prev.map((it): RestItem => {
        if (it.id !== id) return it;
        const nowCompleting = !it.completed;
        return {
          ...it,
          completed: nowCompleting,
          nextAt: nowCompleting
            ? new Date(Date.now() + it.nextIn * 60_000).toISOString()
            : null,
        };
      });

      const toggled = updated.find((i) => i.id === id);
      let newHistory = history;
      if (toggled?.completed) {
        newHistory = [
          ...history,
          {
            text: toggled.text,
            cat: toggled.category,
            completedAt: fmtTime(new Date()),
            nextIn: toggled.nextIn,
          },
        ].slice(-20);
        setHistory(newHistory);
      }

      persist(updated, newHistory);
      return updated;
    });
  }, [history, persist]);

  // ── Delete ──
  const remove = useCallback((id: string): void => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      persist(updated, history);
      return updated;
    });
  }, [history, persist]);

  // ── Derived ──
  const doneCount = items.filter((i) => i.completed).length;
  const progress = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      background: period.bg,
      fontFamily: "'Sora','Segoe UI',sans-serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${period.color}55;border-radius:2px}
        .mono{font-family:'JetBrains Mono',monospace}
        .chip{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;font-size:9px;font-family:'JetBrains Mono',monospace;letter-spacing:1px;text-transform:uppercase}
        .btn-raw{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center}
        @keyframes spin  { to   { transform:rotate(360deg); } }
        @keyframes pulse { from { opacity:0.85; } to { opacity:1; } }
      `}</style>

      {/* Three.js canvas */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />

      {/* Radial vignette */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        background: `radial-gradient(ellipse at 50% -10%, ${period.color}1a 0%, transparent 65%)`,
      }} />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 700, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>

            {/* Brand */}
            <div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: period.accent, opacity: 0.8, marginBottom: 8 }}>
                ◈ {period.label} Recovery
              </div>
              <h1 style={{ fontSize: "clamp(30px,6vw,46px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1 }}>
                Chronos<span style={{ color: period.color }}>.</span>
              </h1>
              <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                {period.desc}
              </p>
            </div>

            {/* Clock */}
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{
                fontSize: "clamp(26px,5vw,40px)", fontWeight: 700, color: period.color,
                lineHeight: 1, letterSpacing: "-1px",
                textShadow: `0 0 28px ${period.color}70`,
                animation: "pulse 1.2s ease-in-out infinite alternate",
              }}>
                {fmtTime(now)}
              </div>
              <div className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginTop: 5, letterSpacing: "1px" }}>
                {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {items.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "2px", textTransform: "uppercase" }}>
                  Recovery Progress
                </span>
                <span className="mono" style={{ fontSize: 10, color: period.color }}>
                  {doneCount} / {items.length} restored
                </span>
              </div>
              <div style={{ height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 1, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: `linear-gradient(90deg, ${period.color}, ${period.accent})`,
                  borderRadius: 1, transition: "width 0.5s ease-out",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Next Rest Beat ── */}
        {/* ── Next Rest Beats ── */}
        {nextBeats.length > 0 && (
          <div style={{
            marginBottom: 20,
            background: `${period.color}08`,
            border: `1px solid ${period.color}28`,
            borderRadius: 12, overflow: "hidden",
          }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: "2px", color: period.accent,
              opacity: 0.7, textTransform: "uppercase",
              padding: "10px 16px 8px",
              borderBottom: `1px solid ${period.color}20`,
            }}>
              ◈ Recovery queue
            </div>
            {nextBeats.map((beat, idx) => (
              <div key={idx} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "10px 16px",
                borderBottom: idx < nextBeats.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{beat.icon}</span>
                  <span style={{
                    fontSize: 12, color: "rgba(255,255,255,0.5)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {beat.label}
                  </span>
                </div>
                <div className="mono" style={{
                  fontSize: 13, fontWeight: 700,
                  color: beat.secsLeft === 0 ? "#facc15" : beat.color,
                  flexShrink: 0,
                }}>
                  {beat.secsLeft === 0 ? "⚡ now" : fmtCountdown(beat.secsLeft)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Generate Button ── */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => { void generate(); }}
            disabled={loading}
            style={{
              width: "100%", padding: "18px 24px",
              background: `linear-gradient(135deg, ${period.color}18, ${period.accent}0a)`,
              border: `1px solid ${period.color}50`, borderRadius: 14,
              color: "white", fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              letterSpacing: "0.3px", fontFamily: "'Sora',sans-serif",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? (
              <>
                <span style={{ display: "inline-block", color: period.color, animation: "spin 0.9s linear infinite" }}>↻</span>
                <span style={{ color: period.accent }}>Analysing your recovery needs…</span>
              </>
            ) : (
              <>
                <span>✦</span>
                <span>Generate {period.label} Rest Plan</span>
                {lastGen && (
                  <span className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginLeft: 4 }}>
                    · {lastGen}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            marginBottom: 16, padding: "12px 16px",
            background: "#ff444420", border: "1px solid #ff444440",
            borderRadius: 10, color: "#fca5a5", fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Rest Items by category ── */}
        {items.length > 0 && (
          <div>
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;
              const { label, color, icon } = CAT_META[cat];

              return (
                <div key={cat} style={{ marginBottom: 28 }}>
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, color }}>
                    <span style={{ fontSize: 12 }}>{icon}</span>
                    <span className="mono" style={{ fontSize: 10, letterSpacing: "2.5px", textTransform: "uppercase" }}>
                      {label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}30, transparent)`, marginLeft: 4 }} />
                  </div>

                  {/* Items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggle(item.id)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "14px 16px",
                          background: item.completed ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.045)",
                          border: `1px solid ${item.completed ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 12, cursor: "pointer",
                          transition: "border-color 0.2s, background 0.2s",
                          opacity: item.completed ? 0.55 : 1,
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          flexShrink: 0, marginTop: 1,
                          color: item.completed ? color : "rgba(255,255,255,0.2)",
                          fontSize: 18, lineHeight: 1, transition: "color 0.2s",
                        }}>
                          {item.completed ? "◉" : "○"}
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14,
                            color: item.completed ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.88)",
                            fontWeight: item.priority === "high" ? 600 : 400,
                            textDecoration: item.completed ? "line-through" : "none",
                            letterSpacing: "0.1px", lineHeight: 1.5,
                          }}>
                            {item.text}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                            {item.meta && (
                              <span className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>
                                {item.meta}
                              </span>
                            )}
                            {item.nextIn > 0 && (
                              <span className="chip" style={{
                                background: `${period.color}15`, color: period.accent,
                                border: `1px solid ${period.color}25`,
                              }}>
                                🔁 every {item.nextIn}m
                              </span>
                            )}
                            {item.priority === "high" && !item.completed && (
                              <span className="chip" style={{
                                background: `${color}15`, color,
                                border: `1px solid ${color}30`,
                              }}>
                                priority
                              </span>
                            )}
                            {item.completed && item.nextAt !== null && (() => {
                              const secsLeft = Math.max(
                                0,
                                Math.round((new Date(item.nextAt).getTime() - Date.now()) / 1000)
                              );
                              return (
                                <span className="chip" style={{
                                  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                }}>
                                  again {secsLeft === 0 ? "now" : `in ${fmtCountdown(secsLeft)}`}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Delete */}
                        <button
                          className="btn-raw"
                          onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                          style={{
                            color: "rgba(255,255,255,0.12)", padding: 4, borderRadius: 6,
                            fontSize: 14, flexShrink: 0, marginTop: 2,
                            transition: "color 0.15s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.12)"; }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* All done */}
            {doneCount === items.length && items.length > 0 && (
              <div style={{
                textAlign: "center", padding: "28px 24px",
                background: `linear-gradient(135deg, ${period.color}0d, transparent)`,
                border: `1px solid ${period.color}28`,
                borderRadius: 16, marginTop: 8,
              }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>🌿</div>
                <p style={{ color: period.color, fontWeight: 700, fontSize: 15 }}>
                  Full recovery cycle complete
                </p>
                <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 12, marginTop: 4 }}>
                  Your body thanks you. Generate the next cycle when ready.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {items.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "72px 24px" }}>
            <div style={{ color: period.color, fontSize: 44, animation: "pulse 3s ease-in-out infinite" }}>
              ◈
            </div>
            <p style={{ marginTop: 20, fontSize: 16, color: period.accent, fontWeight: 600, opacity: 0.7 }}>
              Your body awaits restoration
            </p>
            <p style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
              AI will craft a science-backed recovery plan for this exact moment
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
              {(Object.entries(CAT_META) as [RestCategory, CatMeta][]).map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                  background: `${v.color}10`, border: `1px solid ${v.color}20`,
                  borderRadius: 20, fontSize: 12, color: v.color, opacity: 0.7,
                }}>
                  {v.icon} {v.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── History log ── */}
        {history.length > 0 && (
          <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: "2px", color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase", marginBottom: 12,
            }}>
              Today&apos;s recovery log
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...history].reverse().slice(0, 6).map((h, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12 }}>{CAT_META[h.cat]?.icon ?? "◈"}</span>
                  <span style={{
                    flex: 1, fontSize: 12, color: "rgba(255,255,255,0.4)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {h.text}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
                    {h.completedAt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{
          marginTop: 48, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.14)", letterSpacing: "2px", textTransform: "uppercase" }}>
            Chronos · Recovery AI
          </span>
          <span className="mono" style={{ fontSize: 10, color: period.color, opacity: 0.6, letterSpacing: "1px" }}>
            ◈ {period.label.toUpperCase()}
          </span>
        </div>

      </div>
    </div>
  );
}