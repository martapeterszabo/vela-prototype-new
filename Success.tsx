import { motion } from "motion/react";
import { useEffect } from "react";
import { HomeIndicator, StatusBar, haptic, hero, liqPrice, reducedMotion, usd } from "./lib";
import type { TradeResult } from "./Trade";

type Props = { r: TradeResult; onDone: () => void; onThesis: () => void };

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Success({ r, onDone, onThesis }: Props) {
  const rm = reducedMotion();
  const c = r.side === "long" ? "#5BE3B0" : "#FF6B6B";

  // haptic beats from the motion sketch (TRD-02): 40 ms with the title, 18 ms with the details
  useEffect(() => {
    const a = setTimeout(() => haptic(40), 250);
    const b = setTimeout(() => haptic(18), 380);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const fade = (delay: number) =>
    rm
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: EASE } };

  const rows: [string, string, string?][] = [
    ["Size", usd(r.amount * r.lev)],
    ["Entry price", usd(r.entry)],
    ["Liquidation", usd(liqPrice(r.entry, r.lev, r.side)), "var(--coral-soft)"],
  ];

  const title = r.side === "long" ? "Long opened." : "Trade opened.";
  const sub = r.side === "long" ? `Bitcoin · ${r.lev}× · at market` : `Bitcoin short · ${r.lev}× · at market`;

  const primary = (
    <button className="btn-white pressable" onClick={onDone}>
      Done
    </button>
  );
  const secondary = (
    <button className="btn-glass glass pressable" onClick={onThesis}>
      Add your thesis
    </button>
  );

  return (
    <motion.div
      className="success"
      initial={rm ? { opacity: 0 } : { clipPath: `circle(32px at ${r.origin.x}px ${r.origin.y}px)` }}
      animate={rm ? { opacity: 1 } : { clipPath: `circle(1200px at ${r.origin.x}px ${r.origin.y}px)` }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <StatusBar />
      <div className="hero-bg">
        <div className="drift" style={{ position: "absolute", inset: 0 }}>
          <img src={hero(r.side === "long" ? "hero-long" : "hero-short")} alt="" />
        </div>
      </div>

      <div className="success-body">
        <div className="seal-wrap">
          {!rm &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="ripple"
                style={{ borderColor: c }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: [1, 2.4 + i * 0.35], opacity: [0.55, 0] }}
                transition={{ delay: 0.6 + i * 0.12, duration: 1.1, ease: "easeOut" }}
              />
            ))}
          <motion.svg
            viewBox="0 0 156 156"
            width="156"
            height="156"
            initial={rm ? { opacity: 0 } : { scale: 2.1, opacity: 0 }}
            animate={rm ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={rm ? { duration: 0.3 } : { delay: 0.08, type: "spring", duration: 0.35, bounce: 0.28 }}
          >
            <defs>
              <filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="8" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Seal (glass) */}
            <circle cx="78" cy="78" r="52" fill={c} fillOpacity="0.12" />
            <circle cx="78" cy="78" r="51.5" stroke="white" strokeOpacity="0.25" fill="none" />
            {/* Ring (draws on) */}
            <g filter="url(#ring-glow)">
              <motion.circle
                cx="78"
                cy="78"
                r="60"
                stroke={c}
                strokeWidth="4"
                fill="none"
                transform="rotate(-90 78 78)"
                initial={rm ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.2, duration: 0.4, ease: EASE }}
              />
            </g>
            {/* Check (draws on) */}
            <motion.path
              d="M66 79L74 87L90 70"
              stroke={c}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={rm ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.6, duration: 0.25, ease: "easeOut" }}
            />
          </motion.svg>
        </div>

        <motion.h1 {...fade(0.25)}>{title}</motion.h1>
        <motion.p className="sub" {...fade(0.38)}>
          {sub}
        </motion.p>

        <div className="details">
          {rows.map(([k, v, col], i) => (
            <motion.div key={k} {...fade(0.5 + i * 0.05)}>
              {i > 0 && <div className="divider" />}
              <div className="r">
                <span>{k}</span>
                <b style={col ? { color: col } : undefined}>{v}</b>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div className="actions" {...fade(0.62)}>
          {r.side === "long" ? (
            <>
              {secondary}
              {primary}
            </>
          ) : (
            <>
              {primary}
              {secondary}
            </>
          )}
        </motion.div>
      </div>
      <HomeIndicator />
    </motion.div>
  );
}
