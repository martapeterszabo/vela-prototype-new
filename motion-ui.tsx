import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { reducedMotion } from "./lib";

/* ═══════════════ Rolling number (odometer, Revolut-style) ═══════════════
   Every digit is a vertical strip that rolls in the direction of the change:
   up when the value grows, down when it falls. A soft tint fades in and out
   instead of a hard flash. */

export const ROLL_MS = 900; // regular value change
export const ROLL_INTRO_MS = 1500; // first appearance (rolls up from 0)
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const STAGGER = 45;

const numeric = (t: string) => {
  const n = parseFloat(t.replace(/[^0-9.\-−]/g, "").replace("−", "-"));
  const neg = /^[\s(]*[−-]/.test(t);
  return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : 0;
};

function DigitCol({ d, dir, duration, delay }: { d: number; dir: 1 | -1; duration: number; delay: number }) {
  // strip holds 0-9 three times; we rest in the middle copy (10..19)
  const [pos, setPos] = useState(10 + d);
  const [anim, setAnim] = useState(false);
  const cur = useRef(10 + d);

  useEffect(() => {
    const from = cur.current;
    const fromDigit = from % 10;
    if (fromDigit === d) return;
    const steps = dir > 0 ? (d - fromDigit + 10) % 10 : -((fromDigit - d + 10) % 10);
    const to = from + steps;
    cur.current = to;
    setAnim(true);
    setPos(to);
    const t = setTimeout(() => {
      // snap back to the middle copy without animation
      setAnim(false);
      cur.current = 10 + d;
      setPos(10 + d);
    }, duration + delay + 30);
    return () => clearTimeout(t);
  }, [d, dir, duration, delay]);

  return (
    <span className="rd-col">
      <span
        className="rd-strip"
        style={{
          transform: `translateY(${(-pos / 30) * 100}%)`,
          transition: anim ? `transform ${duration}ms ${EASE} ${delay}ms` : "none",
        }}
      >
        {Array.from({ length: 30 }, (_, i) => (
          <span key={i}>{i % 10}</span>
        ))}
      </span>
    </span>
  );
}

export function RollingNumber({
  dir: forcedDir,
  text,
  className,
  intro = false,
  duration = ROLL_MS,
  tint = true,
}: {
  dir?: number;
  text: string;
  className?: string;
  intro?: boolean;
  duration?: number;
  tint?: boolean;
}) {
  const rm = reducedMotion();
  // on intro, render zeros first, then roll up to the real value
  const [shown, setShown] = useState(intro && !rm ? text.replace(/[0-9]/g, "0") : text);
  const [introPhase, setIntroPhase] = useState(intro && !rm);
  const [dir, setDir] = useState<1 | -1>(1);
  const [tone, setTone] = useState<"" | "up" | "down">("");
  const prev = useRef(shown);

  useEffect(() => {
    if (!introPhase) return;
    const id = requestAnimationFrame(() => {
      setDir(1);
      setShown(text);
      prev.current = text;
    });
    const t = setTimeout(() => setIntroPhase(false), ROLL_INTRO_MS + text.length * 60 + 60);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (introPhase || text === prev.current) {
      if (introPhase) {
        setShown(text);
        prev.current = text;
      }
      return;
    }
    const d: 1 | -1 = forcedDir ? (forcedDir > 0 ? 1 : -1) : numeric(text) >= numeric(prev.current) ? 1 : -1;
    setDir(d);
    setShown(text);
    prev.current = text;
    if (tint) {
      setTone(d > 0 ? "up" : "down");
      const t = setTimeout(() => setTone(""), duration);
      return () => clearTimeout(t);
    }
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const usedDur = rm ? 0 : introPhase ? ROLL_INTRO_MS : duration;
  const chars = shown.split("");
  const n = chars.length;

  return (
    <span className={`rd ${tone ? "rd-" + tone : ""} ${className ?? ""}`} aria-label={text}>
      {chars.map((c, i) => {
        const fromRight = n - 1 - i;
        const delay = rm ? 0 : fromRight * (introPhase ? 60 : STAGGER);
        return /[0-9]/.test(c) ? (
          <DigitCol key={"r" + fromRight} d={Number(c)} dir={dir} duration={usedDur} delay={delay} />
        ) : (
          <span key={"r" + fromRight} className="rd-ch" aria-hidden>
            {c}
          </span>
        );
      })}
    </span>
  );
}

/* ═══════════════ Glow line chart (draws in from the left) ═══════════════ */

export type Pt = [number, number];

/** light 1-2-1 smoothing, endpoints kept */
export function soften(pts: Pt[], passes = 1): Pt[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    p = p.map((pt, i) => (i === 0 || i === p.length - 1 ? pt : [pt[0], (p[i - 1][1] + 2 * pt[1] + p[i + 1][1]) / 4] as Pt));
  }
  return p;
}

/** monotone cubic (Fritsch–Carlson) path: smooth, never overshoots */
export function smoothPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1e-6));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h} ${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h} ${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  }
  return d;
}

/** y on the drawn curve at a given x (for scrubbing) */
export function yOnPath(el: SVGPathElement | null, x: number): number | null {
  if (!el) return null;
  const len = el.getTotalLength();
  let lo = 0;
  let hi = len;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (el.getPointAtLength(mid).x < x) lo = mid;
    else hi = mid;
  }
  return el.getPointAtLength((lo + hi) / 2).y;
}

export const DRAW_MS = 1400;
const DRAW_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

export function GlowLine({
  pts,
  vbW,
  vbH,
  drawKey,
  color = "#5BE3B0",
  highlight = "#C9FFEA",
  areaOpacity = 0.28,
  strokeWidth = 2.4,
  pathRef,
  onDrawn,
}: {
  pts: Pt[];
  vbW: number;
  vbH: number;
  drawKey: string;
  color?: string;
  highlight?: string;
  areaOpacity?: number;
  strokeWidth?: number;
  pathRef?: React.MutableRefObject<SVGPathElement | null>;
  onDrawn?: (done: boolean) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const d = smoothPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  const area = `${d} L${last[0]} ${vbH} L${first[0]} ${vbH} Z`;
  const core = useRef<SVGPathElement | null>(null);
  const progress = useMotionValue(0);
  const clipW = useTransform(progress, (p) => {
    const el = core.current;
    if (!el) return 0;
    return el.getPointAtLength(el.getTotalLength() * p).x + 10;
  });
  const headEl = useRef<HTMLSpanElement | null>(null);
  const [done, setDone] = useState(false);

  useMotionValueEvent(progress, "change", (p) => {
    const el = core.current;
    const h = headEl.current;
    if (!el || !h) return;
    if (p <= 0 || p >= 1) {
      h.style.opacity = "0";
      return;
    }
    const pt = el.getPointAtLength(el.getTotalLength() * p);
    h.style.opacity = "1";
    h.style.left = `${(pt.x / vbW) * 100}%`;
    h.style.top = `${(pt.y / vbH) * 100}%`;
  });

  useLayoutEffect(() => {
    if (reducedMotion()) {
      progress.set(1);
      setDone(true);
      onDrawn?.(true);
      return;
    }
    setDone(false);
    onDrawn?.(false);
    progress.set(0);
    const c = animate(progress, 1, {
      duration: DRAW_MS / 1000,
      ease: DRAW_EASE,
      onComplete: () => {
        setDone(true);
        onDrawn?.(true);
      },
    });
    return () => c.stop();
  }, [drawKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = (x: number, total: number) => `${(x / total) * 100}%`;

  return (
    <>
      <svg className="glowline" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="none" width="100%" height="100%">
        <defs>
          <linearGradient id={`a${uid}`} x1="0" y1={Math.min(...pts.map((p) => p[1]))} x2="0" y2={vbH} gradientUnits="userSpaceOnUse">
            <stop stopColor={color} stopOpacity={areaOpacity} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`s${uid}`} x1={first[0]} y1="0" x2={last[0]} y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor={color} stopOpacity="0.55" />
            <stop offset="0.6" stopColor={color} />
            <stop offset="1" stopColor={highlight} />
          </linearGradient>
          <filter id={`g${uid}`} x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <clipPath id={`c${uid}`}>
            <motion.rect x="-10" y="-40" height={vbH + 80} style={{ width: clipW }} />
          </clipPath>
        </defs>
        <path d={area} fill={`url(#a${uid})`} clipPath={`url(#c${uid})`} />
        {/* soft glow */}
        <motion.path d={d} stroke={color} strokeOpacity="0.55" strokeWidth={strokeWidth * 3.2} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" filter={`url(#g${uid})`} style={{ pathLength: progress }} />
        {/* core */}
        <motion.path
          ref={(el) => {
            core.current = el;
            if (pathRef) pathRef.current = el;
          }}
          d={d}
          stroke={`url(#s${uid})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: progress }}
        />
        {/* specular highlight */}
        <motion.path d={d} stroke="#ffffff" strokeOpacity="0.35" strokeWidth={strokeWidth * 0.35} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: progress }} />
      </svg>
      <span ref={headEl} className="draw-head" style={{ opacity: 0 }} />
      {done && <motion.span className="live-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} style={{ left: pct(last[0], vbW), top: pct(last[1], vbH) }} />}
    </>
  );
}
