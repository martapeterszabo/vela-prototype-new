import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RollingNumber } from "./motion-ui";
import { CASH, HomeIndicator, StatusBar, haptic, hero, icon, liqPrice, usd, useStore, type Side } from "./lib";

export type TradeResult = { side: Side; lev: number; amount: number; entry: number; origin: { x: number; y: number } };
type Props = { initialSide: Side; onClose: () => void; onConfirm: (r: TradeResult) => void };

/* 28 ticks; majors at 1×, 10×, 20×, 30×, 40× */
const KNOTS: [number, number][] = [
  [0, 1],
  [7, 10],
  [14, 20],
  [21, 30],
  [27, 40],
];
const TICKS = 28;
const levAt = (i: number) => {
  for (let k = 1; k < KNOTS.length; k++) {
    const [i0, l0] = KNOTS[k - 1];
    const [i1, l1] = KNOTS[k];
    if (i <= i1) return Math.round(l0 + ((l1 - l0) * (i - i0)) / (i1 - i0));
  }
  return 40;
};
const MAJOR = new Set(KNOTS.map((k) => k[0]));

const THEME = {
  long: { c: "#5be3b0", ink: "#03291c", grad: "linear-gradient(to right, #5be3b0, #3bc994)", glow: "rgba(91,227,176,0.45)", slideGlow: "rgba(91,227,176,0.35)", toggleInk: "#03291c" },
  short: { c: "#ff6b6b", ink: "#2a0808", grad: "linear-gradient(to right, #ff6b6b, #f04f5a)", glow: "rgba(255,107,107,0.45)", slideGlow: "rgba(255,107,107,0.35)", toggleInk: "#ffffff" },
};

export default function Trade({ initialSide, onClose, onConfirm }: Props) {
  const { prices, toast } = useStore();
  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState(810);
  const [typing, setTyping] = useState(false);
  const [tick, setTick] = useState(7);
  const lev = levAt(tick);
  const th = THEME[side];
  const over = amount > CASH;
  const invalid = over || amount <= 0;
  const total = amount * lev;
  const liq = liqPrice(prices.btc, lev, side);
  const dayPct = 2.18;
  const inputRef = useRef<HTMLInputElement>(null);

  const pickPreset = (p: number) => {
    haptic(6);
    setTyping(false);
    setAmount(Math.round(CASH * p * 100) / 100);
  };

  return (
    <div className="trade">
      <StatusBar />
      <div className="hero-bg">
        <div className="drift" style={{ position: "absolute", inset: 0 }}>
          <img src={hero("hero-long")} alt="" style={{ opacity: side === "long" ? 1 : 0 }} />
          <img src={hero("hero-short")} alt="" style={{ opacity: side === "short" ? 1 : 0 }} />
        </div>
      </div>

      <div className="trade-body">
        <div className="trade-top">
          <button className="icon-btn glass" onClick={onClose} aria-label="Close">
            <img src={icon("close-lg")} width={16} height={16} alt="" />
          </button>
          <div className="ttl">
            <b>Bitcoin</b>
            <span>{`${usd(prices.btc)}  ▲ ${dayPct.toFixed(2)}%`}</span>
          </div>
        </div>

        <div className="ls-toggle glass" role="tablist">
          <span
            className="pill"
            style={{
              transform: side === "long" ? "translateX(0)" : "translateX(calc(100% + 4px))",
              background: th.c,
              boxShadow: `0 4px 16px ${th.glow}`,
            }}
          />
          {(["long", "short"] as Side[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={side === s}
              className={side === s ? "on" : ""}
              style={side === s ? { color: THEME[s].toggleInk } : undefined}
              onClick={() => {
                if (s !== side) haptic(8);
                setSide(s);
              }}
            >
              {s === "long" ? "Long  ▲" : "Short  ▼"}
            </button>
          ))}
        </div>

        <p className="size-lbl">Size</p>
        <div className="amount" onClick={() => inputRef.current?.focus()}>
          <span className={"num" + (over ? " over" : "")}>
            {typing ? "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) : <RollingNumber text={"$" + Math.round(amount).toLocaleString("en-US")} tint={false} />}
          </span>
          <span className="caret" style={{ background: th.c }} />
          <input
            ref={inputRef}
            inputMode="decimal"
            aria-label="Size in dollars"
            value={typing ? String(amount || "") : ""}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              setAmount(Math.min(1e7, Number(v) || 0));
            }}
          />
        </div>
        <p className={"cash-line" + (over ? " err" : "")}>{over ? `Not enough cash · ${usd(CASH)} available` : `Available cash  ${usd(CASH)}`}</p>

        <div className="presets">
          {[
            ["10%", 0.1],
            ["25%", 0.25],
            ["50%", 0.5],
            ["Max", 1],
          ].map(([l, p]) => (
            <button key={l} className={"pressable " + (Math.abs(amount - CASH * (p as number)) < 0.01 ? "on" : "glass")} onClick={() => pickPreset(p as number)}>
              {l}
            </button>
          ))}
        </div>

        <div className="lev-head">
          <b>Leverage</b>
          <span>Max 40×</span>
        </div>
        <Ruler tick={tick} setTick={setTick} color={th.c} lev={lev} />

        <div className="summary">
          <div className="r" style={{ color: "var(--muted-2)" }}>
            <span>Order type</span>
            <b style={{ color: "var(--muted-2)" }}>Market</b>
          </div>
          <div className="divider" />
          <div className="r">
            <span>Total size</span>
            <b>{usd(total)}</b>
          </div>
          <div className="divider" />
          <div className="r">
            <span>Liquidation price</span>
            <b style={{ color: "var(--coral-soft)" }}>{usd(liq)}</b>
          </div>
          <div className="divider" />
          <button className="r" style={{ width: "100%", textAlign: "left" }} onClick={() => toast("TP / SL editor isn’t part of this prototype")}>
            <span>Auto close</span>
            <b style={{ color: "var(--peri)" }}>{"Add TP / SL  ›"}</b>
          </button>
          <div className="divider" />
          <div className="r">
            <span>{"Trading fee  ⓘ"}</span>
            <b>{usd(total * 0.0005)}</b>
          </div>
        </div>

        <p className="fine">Isolated margin · executes at market price</p>
        <SlideToConfirm
          label={`Slide to open ${side}`}
          theme={th}
          disabled={invalid}
          onDisabledTry={() => toast(over ? "Size is above your available cash" : "Enter a size first")}
          onDone={(origin) => onConfirm({ side, lev, amount, entry: prices.btc, origin })}
        />
      </div>
      <HomeIndicator />
    </div>
  );
}

function Ruler({ tick, setTick, color, lev }: { tick: number; setTick: (n: number) => void; color: string; lev: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(353);
  const [drag, setDrag] = useState(false);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);
  const step = (w - 2) / (TICKS - 1);
  const xOf = (i: number) => i * step;
  const update = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const i = Math.max(0, Math.min(TICKS - 1, Math.round((clientX - r.left) / step)));
    if (i !== tick) {
      haptic(4); // 4 ms per step
      setTick(i);
    }
  };
  const bubbleLeft = Math.min(w - 50, xOf(tick) + 11);

  return (
    <div
      className="ruler"
      ref={ref}
      role="slider"
      aria-label="Leverage"
      aria-valuemin={1}
      aria-valuemax={40}
      aria-valuenow={lev}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setTick(Math.min(TICKS - 1, tick + 1));
        if (e.key === "ArrowLeft") setTick(Math.max(0, tick - 1));
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        update(e.clientX);
      }}
      onPointerMove={(e) => drag && update(e.clientX)}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      {Array.from({ length: TICKS }, (_, i) => (
        <i key={i} className={"tick" + (MAJOR.has(i) ? " major" : "")} style={{ left: xOf(i), background: i <= tick ? color : undefined }} />
      ))}
      {KNOTS.map(([i, l]) => (
        <span key={i} className={"lbl" + (i === tick ? " on" : "")} style={{ left: xOf(i) + 1 }}>
          {l}×
        </span>
      ))}
      <div className="thumb" style={{ left: xOf(tick), boxShadow: `0 0 12px 1px ${color}e6` }} />
      <div className="bubble glass" style={{ left: bubbleLeft, transform: drag ? "translateY(-4px) scale(1.08)" : "none" }}>
        {lev}×
      </div>
    </div>
  );
}

function SlideToConfirm({
  label,
  theme,
  disabled,
  onDone,
  onDisabledTry,
}: {
  label: string;
  theme: (typeof THEME)["long"];
  disabled: boolean;
  onDone: (origin: { x: number; y: number }) => void;
  onDisabledTry: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);
  const start = useRef(0);
  const max = () => (track.current ? track.current.offsetWidth - 64 : 289);

  useEffect(() => {
    if (!drag && !done) setX(0);
  }, [drag, done]);

  const finish = () => {
    setDone(true);
    setX(max());
    haptic(12); // strong haptic at the end of the slide
    const r = track.current!.getBoundingClientRect();
    const dev = track.current!.closest(".device")!.getBoundingClientRect();
    const scale = dev.width / (track.current!.closest(".device") as HTMLElement).offsetWidth || 1;
    setTimeout(
      () =>
        onDone({
          x: (r.right - 32 - dev.left) / scale,
          y: (r.top + 32 - dev.top) / scale,
        }),
      140,
    );
  };

  const progress = x / max();

  return (
    <div
      ref={track}
      className={"slide" + (disabled ? " disabled" : "")}
      style={{ background: theme.grad, boxShadow: `0 8px 24px ${theme.slideGlow}` }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled && !done) finish();
      }}
      tabIndex={0}
      role="button"
      aria-label={label}
    >
      <div className="trail" style={{ width: x + 64, opacity: drag || done ? 1 : 0, transition: drag ? "none" : "width .45s cubic-bezier(.34,1.56,.64,1), opacity .3s" }} />
      <div
        className="knob"
        style={{ transform: `translateX(${x}px)`, transition: drag ? "none" : "transform .45s cubic-bezier(.34,1.56,.64,1)" }}
        onPointerDown={(e) => {
          if (disabled) {
            onDisabledTry();
            return;
          }
          if (done) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = e.clientX - x;
          setDrag(true);
          haptic(4);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          setX(Math.max(0, Math.min(max(), e.clientX - start.current)));
        }}
        onPointerUp={() => {
          if (!drag) return;
          setDrag(false);
          if (x / max() > 0.86) finish();
        }}
        onPointerCancel={() => setDrag(false)}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4.58333 11H17.4167M11.9167 16.5L17.4167 11L11.9167 5.5" stroke={theme.ink} strokeWidth="2.38333" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="label" style={{ color: theme.ink, opacity: 1 - progress * 1.4 }}>
        {label}
      </span>
      <div className="chevs" style={{ opacity: 1 - progress * 2 }}>
        {[0.25, 0.45, 0.65].map((o) => (
          <svg key={o} width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ opacity: o }}>
            <path d="M2 2L7 7L2 12" stroke={theme.ink} strokeWidth="2" strokeLinecap="round" />
          </svg>
        ))}
      </div>
    </div>
  );
}
