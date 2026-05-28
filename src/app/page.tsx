"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import coreApi from "@/utils/coreApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "login" | "signup";

interface ValidationErrors {
  username?: string;
  password?: string;
  confirm?: string;
}

interface AuthPageProps {
  onAuthSuccess: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALPHANUMERIC = /^[a-zA-Z0-9_]+$/;

function validate(
  mode: Mode,
  username: string,
  password: string,
  confirm: string
): ValidationErrors {
  const errs: ValidationErrors = {};

  if (username.length < 3) {
    errs.username = "Username must be at least 3 characters.";
  } else if (!ALPHANUMERIC.test(username)) {
    errs.username = "No special characters allowed (letters, numbers, _ only).";
  }

  if (password.length < 7) {
    errs.password = "Password must be at least 7 characters.";
  } else if (!ALPHANUMERIC.test(password)) {
    errs.password = "No special characters allowed (letters, numbers, _ only).";
  }

  if (mode === "signup" && password !== confirm) {
    errs.confirm = "Passwords do not match.";
  }

  return errs;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Re-validate on change
  useEffect(() => {
    setErrors(validate(mode, username, password, confirm));
  }, [mode, username, password, confirm]);

  // Reset on mode switch
  const switchMode = (m: Mode) => {
    setMode(m);
    setApiError(null);
    setTouched({});
    setPassword("");
    setConfirm("");
    setSuccess(false);
  };

  // ── Three.js background ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 100);
    camera.position.z = 6;

    // Outer icosahedron wireframe
    const outerMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.4, 4),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#6366f1"),
        wireframe: true,
        transparent: true,
        opacity: 0.07,
      })
    );
    scene.add(outerMesh);

    // Inner icosahedron
    const innerMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 2),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#a5b4fc"),
        wireframe: true,
        transparent: true,
        opacity: 0.05,
      })
    );
    scene.add(innerMesh);

    // Torus ring
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.006, 8, 140),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#818cf8"), transparent: true, opacity: 0.2 })
    );
    torus.rotation.x = Math.PI / 2.8;
    scene.add(torus);

    // Second torus, tilted
    const torus2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.004, 8, 100),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#c084fc"), transparent: true, opacity: 0.12 })
    );
    torus2.rotation.x = Math.PI / 1.6;
    torus2.rotation.y = Math.PI / 4;
    scene.add(torus2);

    // Particles
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 24;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: new THREE.Color("#6366f1"), size: 0.02, transparent: true, opacity: 0.45 })
    );
    scene.add(points);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const pl = new THREE.PointLight(new THREE.Color("#6366f1"), 2.8, 14);
    pl.position.set(5, 4, 4);
    scene.add(pl);

    let t = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      t += 0.003;
      outerMesh.rotation.x = t * 0.22;
      outerMesh.rotation.y = t * 0.42;
      innerMesh.rotation.x = -t * 0.32;
      innerMesh.rotation.y = t * 0.58;
      torus.rotation.z = t * 0.12;
      torus2.rotation.z = -t * 0.18;
      points.rotation.y = t * 0.035;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
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
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    // Mark all fields as touched to reveal errors
    setTouched({ username: true, password: true, confirm: true });

    const errs = validate(mode, username, password, confirm);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setApiError(null);

    try {
      if (mode === "login") {
        await coreApi.login(username, password);
      } else {
        await coreApi.signup(username, password);
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/start");
      }, 800);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error
          ? err.message
          : mode === "login"
          ? "Invalid credentials. Please try again."
          : "Could not create account. Username may already be taken."
      );
    } finally {
      setLoading(false);
    }
  }, [mode, username, password, confirm, onAuthSuccess]);

  // Allow Enter to submit
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleSubmit();
  };

  const color = "#6366f1";
  const accent = "#a5b4fc";

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#020208",
        fontFamily: "'Sora','Segoe UI',sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .mono{font-family:'JetBrains Mono',monospace}
        .auth-input{
          width:100%;padding:13px 44px 13px 16px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;
          color:#fff;font-size:14px;
          font-family:'Sora',sans-serif;
          outline:none;
          transition:border-color 0.2s,box-shadow 0.2s;
          caret-color:${accent};
        }
        .auth-input::placeholder{color:rgba(255,255,255,0.2)}
        .auth-input:focus{
          border-color:${color}90;
          box-shadow:0 0 0 3px ${color}18;
        }
        .auth-input.error{
          border-color:#f8717160;
          box-shadow:0 0 0 3px #f8717115;
        }
        .tab-btn{
          all:unset;cursor:pointer;
          padding:8px 20px;border-radius:8px;
          font-size:13px;font-weight:600;
          font-family:'Sora',sans-serif;
          transition:all 0.2s;
        }
        .tab-btn.active{
          background:${color}22;
          color:${accent};
          border:1px solid ${color}40;
        }
        .tab-btn.inactive{
          color:rgba(255,255,255,0.28);
          border:1px solid transparent;
        }
        .tab-btn.inactive:hover{color:rgba(255,255,255,0.55);}
        .icon-btn{
          all:unset;cursor:pointer;
          position:absolute;right:14px;top:50%;transform:translateY(-50%);
          color:rgba(255,255,255,0.28);font-size:16px;
          transition:color 0.15s;user-select:none;
        }
        .icon-btn:hover{color:rgba(255,255,255,0.6);}
        @keyframes spin   {to{transform:rotate(360deg)}}
        @keyframes pulse  {from{opacity:0.8}to{opacity:1}}
        @keyframes fadeIn {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shake  {0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
        .card{animation:fadeIn 0.45s ease-out both}
        .shake{animation:shake 0.35s ease-in-out}
      `}</style>

      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
      />

      {/* Radial glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        background: `radial-gradient(ellipse at 50% 0%, ${color}18 0%, transparent 60%)`,
      }} />

      {/* Card */}
      <div
        className="card"
        style={{
          position: "relative", zIndex: 10,
          width: "100%", maxWidth: 400,
          margin: "0 auto",
          padding: "0 20px",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="mono" style={{
            fontSize: 10, letterSpacing: "3px", textTransform: "uppercase",
            color: accent, opacity: 0.7, marginBottom: 10,
          }}>
            ◈ Recovery Intelligence
          </div>
          <h1 style={{
            fontSize: 42, fontWeight: 800, color: "#fff",
            letterSpacing: "-1.5px", lineHeight: 1,
          }}>
            Chronos<span style={{ color }}>.</span>
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
            Your science-backed restoration system
          </p>
        </div>

        {/* Panel */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          padding: "28px 28px 32px",
          backdropFilter: "blur(12px)",
        }}>
          {/* Mode tabs */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 28,
            background: "rgba(255,255,255,0.035)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10, padding: 4,
          }}>
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                className={`tab-btn ${mode === m ? "active" : "inactive"}`}
                style={{ flex: 1, textAlign: "center" }}
                onClick={() => switchMode(m)}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Username */}
            <div>
              <label className="mono" style={{
                display: "block", fontSize: 9, letterSpacing: "2px",
                textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
                marginBottom: 7,
              }}>
                Username
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className={`auth-input${touched.username && errors.username ? " error" : ""}`}
                  type="text"
                  placeholder="e.g. chronos_user"
                  value={username}
                  autoComplete="username"
                  onKeyDown={onKeyDown}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setApiError(null);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                />
                <span style={{
                  position: "absolute", right: 14, top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 14, pointerEvents: "none",
                  color: touched.username && errors.username
                    ? "#f87171"
                    : username.length >= 3 && !errors.username
                    ? "#4ade80"
                    : "rgba(255,255,255,0.15)",
                }}>
                  {touched.username && errors.username ? "✕" : username.length >= 3 && !errors.username ? "✓" : "◎"}
                </span>
              </div>
              {touched.username && errors.username && (
                <p style={{ marginTop: 5, fontSize: 11, color: "#f87171", fontWeight: 500 }}>
                  {errors.username}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mono" style={{
                display: "block", fontSize: 9, letterSpacing: "2px",
                textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
                marginBottom: 7,
              }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className={`auth-input${touched.password && errors.password ? " error" : ""}`}
                  type={showPass ? "text" : "password"}
                  placeholder="min. 7 characters"
                  value={password}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  onKeyDown={onKeyDown}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setApiError(null);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  style={{ paddingRight: "44px" } as React.CSSProperties}
                />
                <button
                  className="icon-btn"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                  type="button"
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
              {touched.password && errors.password && (
                <p style={{ marginTop: 5, fontSize: 11, color: "#f87171", fontWeight: 500 }}>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm password (signup only) */}
            {mode === "signup" && (
              <div>
                <label className="mono" style={{
                  display: "block", fontSize: 9, letterSpacing: "2px",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
                  marginBottom: 7,
                }}>
                  Confirm Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className={`auth-input${touched.confirm && errors.confirm ? " error" : ""}`}
                    type={showConfirm ? "text" : "password"}
                    placeholder="repeat your password"
                    value={confirm}
                    autoComplete="new-password"
                    onKeyDown={onKeyDown}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setApiError(null);
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                    style={{ paddingRight: "44px" } as React.CSSProperties}
                  />
                  <button
                    className="icon-btn"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((v) => !v)}
                    type="button"
                  >
                    {showConfirm ? "🙈" : "👁"}
                  </button>
                </div>
                {touched.confirm && errors.confirm && (
                  <p style={{ marginTop: 5, fontSize: 11, color: "#f87171", fontWeight: 500 }}>
                    {errors.confirm}
                  </p>
                )}
              </div>
            )}

            {/* Password strength bar (signup) */}
            {mode === "signup" && password.length > 0 && (
              <div>
                {(() => {
                  const len = password.length;
                  const strength = len < 7 ? 0 : len < 10 ? 1 : len < 14 ? 2 : 3;
                  const labels = ["Too short", "Fair", "Good", "Strong"];
                  const colors = ["#f87171", "#fbbf24", "#38bdf8", "#4ade80"];
                  const widths = ["20%", "40%", "70%", "100%"];
                  return (
                    <div>
                      <div style={{ height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 1, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: widths[strength],
                          background: colors[strength],
                          borderRadius: 1,
                          transition: "width 0.3s ease-out, background 0.3s",
                        }} />
                      </div>
                      <div className="mono" style={{
                        marginTop: 4, fontSize: 9, letterSpacing: "1.5px",
                        color: colors[strength], textTransform: "uppercase",
                      }}>
                        {labels[strength]}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* API error */}
            {apiError && (
              <div style={{
                padding: "10px 14px",
                background: "#f8717115",
                border: "1px solid #f8717140",
                borderRadius: 8,
                color: "#fca5a5",
                fontSize: 12,
                fontWeight: 500,
              }}>
                {apiError}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={() => void handleSubmit()}
              disabled={loading || success}
              style={{
                all: "unset" as const,
                marginTop: 4,
                width: "100%",
                padding: "15px 24px",
                background: success
                  ? "linear-gradient(135deg, #4ade8022, #4ade8010)"
                  : `linear-gradient(135deg, ${color}22, ${accent}10)`,
                border: `1px solid ${success ? "#4ade8060" : color + "55"}`,
                borderRadius: 12,
                color: success ? "#4ade80" : "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || success ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                letterSpacing: "0.3px",
                fontFamily: "'Sora',sans-serif",
                textAlign: "center" as const,
                boxSizing: "border-box" as const,
                transition: "opacity 0.2s, border-color 0.3s",
              }}
            >
              {success ? (
                <>
                  <span>✓</span>
                  <span style={{ color: "#4ade80" }}>Welcome to Chronos</span>
                </>
              ) : loading ? (
                <>
                  <span style={{
                    display: "inline-block",
                    color,
                    animation: "spin 0.9s linear infinite",
                  }}>↻</span>
                  <span style={{ color: accent }}>
                    {mode === "login" ? "Signing in…" : "Creating account…"}
                  </span>
                </>
              ) : (
                <>
                  <span>✦</span>
                  <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hint */}
        <p style={{
          marginTop: 20, textAlign: "center",
          fontSize: 12, color: "rgba(255,255,255,0.18)",
        }}>
          {mode === "login"
            ? "No account yet? "
            : "Already have an account? "}
          <button
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            style={{
              all: "unset",
              cursor: "pointer",
              color: accent,
              fontWeight: 600,
              fontSize: 12,
              opacity: 0.8,
              textDecoration: "underline",
              textDecorationColor: `${accent}50`,
            }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        {/* Rules reminder */}
        <div style={{
          marginTop: 18, display: "flex", gap: 10,
          justifyContent: "center", flexWrap: "wrap",
        }}>
          {[
            "≥ 3 char username",
            "≥ 7 char password",
            "letters & numbers only",
          ].map((rule) => (
            <span
              key={rule}
              className="mono"
              style={{
                fontSize: 9, letterSpacing: "1px",
                color: "rgba(255,255,255,0.15)",
                padding: "3px 8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 4,
              }}
            >
              {rule}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="mono" style={{
            fontSize: 10, color: "rgba(255,255,255,0.12)",
            letterSpacing: "2px", textTransform: "uppercase",
          }}>
            Chronos · Recovery AI
          </span>
        </div>
      </div>
    </div>
  );
}