import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// all images live next to the code (flat repo); Vite fingerprints and serves them
const SVGS = import.meta.glob("./*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const WEBPS = import.meta.glob("./*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
export const icon = (name: string) => SVGS[`./${name}.svg`];
export const hero = (name: string) => WEBPS[`./${name}.webp`];

/* ─────────── formatting ─────────── */
export const usd = (v: number, digits = 2) =>
  (v < 0 ? "−$" : "$") +
  Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const signedUsd = (v: number, digits = 2) => (v >= 0 ? "+" : "") + usd(v, digits);
export const pct = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%";

/* ─────────── haptics (Android Chrome only; no-op elsewhere) ─────────── */
export const haptic = (ms: number) => {
  try {
    if ("vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
};

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─────────── count-up ─────────── */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export function useCountUp(target: number, duration = 1100, from?: number) {
  const [v, setV] = useState(from ?? target);
  const cur = useRef(from ?? target);
  useEffect(() => {
    if (reducedMotion() || duration <= 0) {
      cur.current = target;
      setV(target);
      return;
    }
    const start = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const val = start + (target - start) * easeOutCubic(k);
      cur.current = val;
      setV(val);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

/* ─────────── live number: flashes the digits that changed ─────────── */
export function LiveNumber({ text, dir, className }: { text: string; dir: 1 | -1 | 0; className?: string }) {
  const prev = useRef(text);
  const [flash, setFlash] = useState<boolean[]>([]);
  useEffect(() => {
    const p = prev.current;
    if (p !== text) {
      const f = text.split("").map((c, i) => p.length !== text.length || p[i] !== c);
      setFlash(f);
      const id = setTimeout(() => setFlash([]), 420);
      prev.current = text;
      return () => clearTimeout(id);
    }
  }, [text]);
  const cls = dir > 0 ? "flash-up" : dir < 0 ? "flash-down" : "";
  return (
    <span className={"ln " + (className ?? "")}>
      {text.split("").map((c, i) => (
        <span key={i} className={flash[i] ? cls : ""}>
          {c}
        </span>
      ))}
    </span>
  );
}

/* ─────────── market model ─────────── */
export const BTC_BASE = 98412.5;
export const BTC_PREV_CLOSE = BTC_BASE - 2104.3;
export const CASH = 3240;

export type Side = "long" | "short";
export type Position = {
  id: string;
  asset: "BTC" | "NVDA";
  name: string;
  side: Side;
  lev: number;
  margin: number;
  entry: number;
  thesis?: string;
  liq?: number;
};

const BTC_QTY_ENTRY = 96310;

export const seedPositions: Position[] = [
  { id: "btc-1", asset: "BTC", name: "Bitcoin", side: "long", lev: 10, margin: 2500, entry: BTC_QTY_ENTRY, liq: 87120, thesis: "ETF inflows + post-halving supply squeeze into Q4." },
  { id: "nvda-1", asset: "NVDA", name: "NVIDIA", side: "short", lev: 5, margin: 800, entry: 139.867 },
];

export function pnlOf(p: Position, prices: Prices) {
  const px = p.asset === "BTC" ? prices.btc : prices.nvda;
  const qty = (p.margin * p.lev) / p.entry;
  return (p.side === "long" ? px - p.entry : p.entry - px) * qty;
}
export const posLiq = (p: Position) => p.liq ?? liqPrice(p.entry, p.lev, p.side);
export const liqPrice = (entry: number, lev: number, side: Side) =>
  Math.round((side === "long" ? entry * (1 - 1 / lev + 0.00497) : entry * (1 + 1 / lev - 0.00497)) / 10) * 10;

export type Prices = { btc: number; nvda: number; btcDir: 1 | -1 | 0; nvdaDir: 1 | -1 | 0 };

type Store = {
  prices: Prices;
  positions: Position[];
  addPosition: (p: Position) => void;
  closePosition: (id: string) => void;
  setThesis: (id: string, t: string) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
};
const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<Prices>({ btc: BTC_BASE, nvda: 141.2, btcDir: 0, nvdaDir: 0 });
  const [positions, setPositions] = useState<Position[]>(seedPositions);
  const [toastMsg, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  // gentle random walk, mean-reverting around the design values so screens stay recognisable
  useEffect(() => {
    const id = window.setInterval(() => {
      setPrices((p) => {
        const db = (Math.random() - 0.5) * 38 + (BTC_BASE - p.btc) * 0.12;
        const dn = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 0.12 + (141.2 - p.nvda) * 0.2;
        const btc = Math.round((p.btc + db) * 2) / 2;
        const nvda = Math.round((p.nvda + dn) * 100) / 100;
        return {
          btc,
          nvda,
          btcDir: btc > p.btc ? 1 : btc < p.btc ? -1 : 0,
          nvdaDir: nvda > p.nvda ? 1 : nvda < p.nvda ? -1 : 0,
        };
      });
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<Store>(
    () => ({
      prices,
      positions,
      addPosition: (p) => setPositions((ps) => [p, ...ps]),
      closePosition: (id) => setPositions((ps) => ps.filter((x) => x.id !== id)),
      setThesis: (id, t) => setPositions((ps) => ps.map((x) => (x.id === id ? { ...x, thesis: t } : x))),
      toast: (msg) => {
        setToast(msg);
        clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2200);
      },
      toastMsg,
    }),
    [prices, positions, toastMsg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ─────────── shared chrome ─────────── */
export function StatusBar() {
  return (
    <div className="status-bar">
      <span className="time">9:41</span>
      <img src={icon("statusicons")} alt="" />
    </div>
  );
}
export const HomeIndicator = () => <div className="home-indicator" />;

export function AssetIcon({ bg, glyph, size = 40, color = "#fff", fontSize }: { bg: string; glyph: string; size?: number; color?: string; fontSize?: number }) {
  return (
    <div className="asset-icon" style={{ background: bg, width: size, height: size, borderRadius: size / 2, color, fontSize: fontSize ?? (size >= 40 ? 16 : 13) }}>
      {glyph}
    </div>
  );
}
