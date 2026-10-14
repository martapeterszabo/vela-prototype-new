import { GlowLine, RollingNumber, soften, yOnPath } from "./motion-ui";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_POINTS } from "./chartPoints";
import { AssetIcon, BTC_PREV_CLOSE, HomeIndicator, StatusBar, haptic, hero, icon, posLiq, pct, pnlOf, signedUsd, usd, useStore, type Side } from "./lib";

type Props = { onBack: () => void; onTrade: (side: Side) => void };

const W = 393;
const H = 300;
const END: [number, number] = [365, 20];
const ENTRY_Y = 142.15;
const LIQ_Y = 282;
const PX_PER_USD = 122.15 / 2102.5; // calibrated: entry $96,310 ↔ y 142.15, last $98,412.50 ↔ y 20

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
function series(range: string): [number, number][] {
  if (range === "1H") return CHART_POINTS;
  const seed = { "15m": 7, "1D": 21, "7D": 3, "1M": 11, All: 5 }[range] ?? 1;
  const r = seeded(seed * 7919);
  const n = CHART_POINTS.length;
  const start = { "15m": 120, "1D": 220, "7D": 200, "1M": 250, All: 278 }[range] ?? 200;
  const vol = { "15m": 9, "1D": 7, "7D": 8, "1M": 9, All: 6 }[range] ?? 7;
  const ys: number[] = [];
  let y = start;
  for (let i = 0; i < n; i++) {
    const target = start + (END[1] - start) * (i / (n - 1));
    y += (r() - 0.5) * vol * 2 + (target - y) * 0.18;
    ys.push(Math.max(8, Math.min(292, y)));
  }
  ys[n - 1] = END[1];
  return CHART_POINTS.map(([x], i) => [x, ys[i]]);
}

const TRADERS = [
  { h: "@kova", c: "#7b95ff", side: "long" as Side, lev: 20, size: 182.4, pnl: 14210, avg: 95880, q: "Breakout over 97k held twice. Adding on dips.", ago: 42, follow: true },
  { h: "@nightdesk", c: "#ff9f43", side: "short" as Side, lev: 5, size: 64, pnl: -460, avg: 99120, q: "Funding too hot, fading the move into 100k.", ago: 8, follow: false },
  { h: "@mira.eth", c: "#5be3b0", side: "long" as Side, lev: 3, size: 23.5, pnl: 1180, avg: 93450, q: "Slow money. Holding through the halving cycle.", ago: 15, follow: true },
  { h: "@lumen", c: "#c9d4ff", side: "long" as Side, lev: 10, size: 8.2, pnl: 312, avg: 97020, q: "Small size, testing the range high.", ago: 3, follow: false },
];

export default function Asset({ onBack, onTrade }: Props) {
  const { prices, positions, closePosition, toast } = useStore();
  const pos = positions.find((p) => p.asset === "BTC");
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [starred, setStarred] = useState(true);
  const star = useAnimationControls();
  const [range, setRange] = useState("1H");
  const [tab, setTab] = useState<"Feed" | "Stats">("Feed");
  const [filter, setFilter] = useState<"Top by size" | "Recent">("Top by size");
  const [following, setFollowing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [ratioOn, setRatioOn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRatioOn(true), 250);
    return () => clearTimeout(t);
  }, []);

  const [int, dec] = usd(prices.btc).split(".");
  const dayChg = prices.btc - BTC_PREV_CLOSE;

  const traders = useMemo(() => {
    let t = [...TRADERS];
    if (following) t = t.filter((x) => x.follow);
    if (filter === "Recent") t = t.filter((x) => x.size >= 10).sort((a, b) => a.ago - b.ago);
    else t.sort((a, b) => b.size - a.size);
    return t;
  }, [filter, following]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", overflow: "hidden" }}>
      <StatusBar />
      <div className={"asset-header" + (scrolled ? " scrolled" : "")}>
        <button className="icon-btn glass" onClick={onBack} aria-label="Back">
          <img src={icon("back")} width={20} height={20} alt="" />
        </button>
        <div className="mini">
          <b>Bitcoin</b>
          <span>
            <RollingNumber text={usd(prices.btc)} dir={prices.btcDir} /> ▲ {((dayChg / BTC_PREV_CLOSE) * 100).toFixed(2)}%
          </span>
        </div>
        <motion.button
          className="icon-btn glass"
          aria-label="Watchlist"
          aria-pressed={starred}
          animate={star}
          onClick={() => {
            haptic(10);
            const on = !starred;
            setStarred(on);
            star.start({ scale: [1, 1.45, 1], rotate: [0, 8, 0], transition: { type: "spring", duration: 0.55, bounce: 0.5 } });
            toast(on ? "Added to watchlist" : "Removed from watchlist");
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path
              d="M10 2.91667L12.1667 7.33333L17.0833 8.08333L13.5 11.5L14.3333 16.3333L10 14.0833L5.66667 16.3333L6.5 11.5L2.91667 8.08333L7.83333 7.33333L10 2.91667Z"
              fill={starred ? "#9DB0FF" : "none"}
              stroke={starred ? "none" : "#c9d4ff"}
              strokeWidth={1.5}
              strokeLinejoin="round"
              style={{ transition: "fill .2s" }}
            />
          </svg>
        </motion.button>
        <button className="icon-btn glass" aria-label="Share" onClick={() => toast("Share sheet would open here")}>
          <img src={icon("share")} width={20} height={20} alt="" />
        </button>
      </div>

      <div className="scroller" ref={scroller} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 110)}>
        <div className="hero-bg">
          <div className="drift" style={{ position: "absolute", inset: 0 }}>
            <img src={hero("hero-asset")} alt="" />
          </div>
        </div>
        <div className="asset-content">
          <div className="price-block">
            <div className="id">
              <AssetIcon bg="#f7931a" glyph="₿" size={32} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>Bitcoin</span>
                <span className="t-meta">BTC · Crypto · up to 40×</span>
              </div>
            </div>
            <div className="big" style={{ opacity: scrolled ? 0 : 1, transition: "opacity .25s" }}>
              <RollingNumber text={int} dir={prices.btcDir} className="int" tint={false} />
              <RollingNumber text={"." + dec} dir={prices.btcDir} className="dec" tint={false} />
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 14 }}>
              <span className="t-up" style={{ fontWeight: 700 }}>
                ▲ {usd(dayChg)} ({((dayChg / BTC_PREV_CLOSE) * 100).toFixed(2)}%)
              </span>
              <span style={{ fontWeight: 500, color: "var(--muted-2)" }}>Today</span>
            </div>
          </div>

          <Chart range={range} showLevels={!!pos} entry={pos?.entry ?? 0} liq={pos ? posLiq(pos) : 0} />

          <div className="trange glass">
            {["15m", "1H", "1D", "7D", "1M", "All"].map((r) => (
              <button
                key={r}
                className={r === range ? "on" : ""}
                onClick={() => {
                  haptic(4);
                  setRange(r);
                }}
              >
                {r === range && <motion.span layoutId="trange-pill" className="pill" style={{ inset: 0, position: "absolute", background: "#fff", borderRadius: 18 }} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span style={{ position: "relative" }}>{r}</span>
              </button>
            ))}
          </div>

          <div className="ratio">
            <div className="lbls">
              <span className="t-up" style={{ flex: 1 }}>Long 64%</span>
              <span className="mid">Traders on Vela · 24h</span>
              <span className="t-down">Short 36%</span>
            </div>
            <div className="bars">
              <i style={{ background: "var(--mint)", flexGrow: ratioOn ? 64 : 50, flexBasis: 0 }} />
              <i style={{ background: "var(--coral)", flexGrow: ratioOn ? 36 : 50, flexBasis: 0 }} />
            </div>
          </div>

          <div className="below">
            {pos ? <PositionCard /> : <NoPosition onTrade={onTrade} />}

            {pos && (
              <div className="list tight">
                <button className="prow" onClick={() => onTrade(pos.side)}>
                  <b>Auto close</b>
                  <span>TP $105,000 · SL $92,000</span>
                  <img src={icon("chevron")} width={16} height={16} alt="" />
                </button>
                <div className="divider" />
                <button className="prow" onClick={() => toast("Thesis editor isn’t wired here")}>
                  <b>Thesis</b>
                  <span>“{pos.thesis ?? "Add your thesis"}”</span>
                  <img src={icon("chevron")} width={16} height={16} alt="" />
                </button>
                <div className="divider" />
                <button className="prow" onClick={() => toast("History export isn’t wired")}>
                  <b>History</b>
                  <span>12 trades · export for tax</span>
                  <img src={icon("chevron")} width={16} height={16} alt="" />
                </button>
              </div>
            )}

            <div className="tabs2">
              {(["Feed", "Stats"] as const).map((t) => (
                <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                  {t}
                  <i />
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {tab === "Feed" ? (
                <motion.div key="feed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="filters">
                    {(["Top by size", "Recent"] as const).map((f) => (
                      <button key={f} className={"chip pressable " + (filter === f ? "on" : "glass")} onClick={() => setFilter(f)}>
                        {f}
                      </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--muted-2)" }}>Following</span>
                    <button className={"switch" + (following ? " on" : "")} role="switch" aria-checked={following} onClick={() => setFollowing(!following)}>
                      <i />
                    </button>
                  </div>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {traders.map((t) => (
                      <motion.div layout key={t.h} className="trader" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div className="av" style={{ background: t.c }}>{t.h[1].toUpperCase()}</div>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{t.h}</span>
                            <span className={t.side === "long" ? "t-up" : "t-down"} style={{ fontWeight: 600, fontSize: 12 }}>
                              {t.side === "long" ? "Long" : "Short"} {t.lev}× · ${t.size.toFixed(1)}K
                            </span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                            <span className={t.pnl >= 0 ? "t-up" : "t-down"} style={{ fontWeight: 700, fontSize: 15 }}>
                              {signedUsd(t.pnl, 0)}
                            </span>
                            <span className="t-meta">Avg. {usd(t.avg, 0)}</span>
                          </div>
                        </div>
                        <p className="quote">“{t.q}”</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {traders.length === 0 && <p className="empty">No positions match these filters</p>}
                </motion.div>
              ) : (
                <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="stat-card">
                    {[
                      ["52w high", "$108,268.40"],
                      ["52w low", "$56,552.10"],
                      ["24h change", pct((dayChg / BTC_PREV_CLOSE) * 100)],
                      ["24h volume", "$4.1B"],
                      ["Max leverage", "40×"],
                    ].map(([k, v], i) => (
                      <div key={k}>
                        {i > 0 && <div className="divider" />}
                        <div className="prow">
                          <span style={{ textAlign: "left", fontSize: 14 }}>{k}</span>
                          <b style={{ color: k === "24h change" ? "var(--mint)" : "#fff" }}>{v}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="trader">
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>About</span>
                    <p className="quote" style={{ lineHeight: "20px", color: "var(--lav)" }}>
                      Bitcoin is a decentralised digital currency with a fixed supply of 21 million coins. On Vela you can trade BTC perpetuals around the clock, long or short, with up to 40× leverage.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="bottom-fade" style={{ height: 150 }} />
      <div className="action-bar">
        {pos ? (
          <>
            <button className="glass pressable" style={{ color: "#fff" }} onClick={() => onTrade(pos.side)}>
              Modify
            </button>
            <button className="pressable" style={{ background: "#fff", color: "var(--bg)" }} onClick={() => setSheet(true)}>
              Close
            </button>
          </>
        ) : (
          <>
            <button className="glass pressable" style={{ color: "var(--coral)" }} onClick={() => onTrade("short")}>
              Short ▼
            </button>
            <button className="pressable" style={{ background: "#fff", color: "var(--bg)" }} onClick={() => onTrade("long")}>
              Long ▲
            </button>
          </>
        )}
      </div>
      <HomeIndicator />

      <AnimatePresence>
        {sheet && pos && (
          <>
            <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(false)} />
            <motion.div className="sheet" initial={{ y: "110%" }} animate={{ y: 0 }} exit={{ y: "110%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
              <div className="grab" />
              <h3>Close position?</h3>
              <p className="sub">
                Bitcoin · {pos.side === "long" ? "Long" : "Short"} {pos.lev}× · realised PnL{" "}
                <b style={{ color: pnlOf(pos, prices) >= 0 ? "var(--mint)" : "var(--coral)" }}>{signedUsd(pnlOf(pos, prices))}</b>
              </p>
              <div className="stack">
                <button
                  className="btn-white pressable"
                  onClick={() => {
                    haptic(12);
                    closePosition(pos.id);
                    setSheet(false);
                    toast("Position closed");
                  }}
                >
                  Close at market
                </button>
                <button className="btn-glass glass pressable" onClick={() => setSheet(false)}>
                  Keep open
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PositionCard() {
  const { prices, positions, toast } = useStore();
  const pos = positions.find((p) => p.asset === "BTC")!;
  const pnl = pnlOf(pos, prices);
  const dir = (pos.side === "long" ? prices.btcDir : -prices.btcDir) as 1 | -1 | 0;
  return (
    <div className="pos-card">
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: "var(--lav)" }}>Your position</span>
        <span className={"badge " + pos.side} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 8 }}>
          {pos.side === "long" ? "Long" : "Short"} {pos.lev}×
        </span>
      </div>
      <div className="pnl" style={{ color: pnl >= 0 ? "var(--mint)" : "var(--coral)" }}>
        <RollingNumber className="big" text={signedUsd(pnl)} dir={dir} />
        <span className="pct">{pct((pnl / pos.margin) * 100)}</span>
      </div>
      <div className="kv-grid">
        <div>
          <div className="k">Lev. size</div>
          <div className="v">{usd(pos.margin * pos.lev)}</div>
        </div>
        <div>
          <div className="k">Avg. entry</div>
          <div className="v">{usd(pos.entry)}</div>
        </div>
        <div>
          <div className="k">Liq. price</div>
          <div className="v" style={{ color: "var(--coral-soft)" }}>
            {usd(posLiq(pos))}
          </div>
        </div>
        <div>
          <div className="k">Funding</div>
          <div className="v">−$1.84</div>
        </div>
      </div>
      <button className="share-btn glass pressable" onClick={() => toast("Share card generated")}>
        <img src={icon("share-sm")} width={16} height={16} alt="" /> Share position
      </button>
    </div>
  );
}

function NoPosition({ onTrade }: { onTrade: (s: Side) => void }) {
  return (
    <div className="pos-card" style={{ alignItems: "flex-start" }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--lav)" }}>No open position</span>
      <p style={{ color: "var(--muted-2)", fontSize: 14, lineHeight: "20px" }}>Go long if you think Bitcoin rises, short if you think it falls.</p>
      <button className="share-btn glass pressable" style={{ width: "100%" }} onClick={() => onTrade("long")}>
        Open a trade
      </button>
    </div>
  );
}

/* ─────────── Chart: draws in from the left, live dot, scrub with glass tooltip ─────────── */
function Chart({ range, showLevels, entry, liq }: { range: string; showLevels: boolean; entry: number; liq: number }) {
  const { prices } = useStore();
  const pts = useMemo(() => soften(series(range), 2), [range]);
  const lineRef = useRef<SVGPathElement | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<{ x: number; y: number } | null>(null);
  const lastIdx = useRef(-1);

  const at = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(END[0], ((clientX - r.left) / r.width) * W));
    let i = pts.findIndex((p) => p[0] >= x);
    if (i <= 0) i = 1;
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const y = yOnPath(lineRef.current, x) ?? y0 + ((y1 - y0) * (x - x0)) / Math.max(0.001, x1 - x0);
    if (i !== lastIdx.current && i % 4 === 0) haptic(2);
    lastIdx.current = i;
    setScrub({ x, y });
  };

  const priceAt = (y: number) => prices.btc - (y - END[1]) / PX_PER_USD;
  const timeAt = (x: number) => {
    const minsBack = ((END[0] - x) / END[0]) * { "15m": 15, "1H": 60, "1D": 1440, "7D": 10080, "1M": 43200, All: 525600 }[range]!;
    const d = new Date(2026, 9, 12, 10, 57 - minsBack);
    if (range === "15m" || range === "1H" || range === "1D") return d.toTimeString().slice(0, 5);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const yFor = (p: number) => END[1] + (prices.btc - p) * PX_PER_USD;
  const entryY = range === "1H" ? ENTRY_Y : Math.max(12, Math.min(288, yFor(entry)));
  const liqY = range === "1H" ? LIQ_Y : Math.min(288, yFor(liq));

  const pctX = (x: number) => `${(x / W) * 100}%`;
  const tipW = 150;

  return (
    <div
      className="chart"
      ref={box}
      onPointerDown={(e) => {
        haptic(8);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        at(e.clientX);
      }}
      onPointerMove={(e) => (e.buttons || e.pointerType === "touch") && scrub && at(e.clientX)}
      onPointerUp={() => setScrub(null)}
      onPointerCancel={() => setScrub(null)}
    >
      <GlowLine pts={pts} vbW={W} vbH={H} drawKey={range} pathRef={lineRef} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%">
        {showLevels && (
          <>
            <line x1="0" x2={W} y1={entryY} y2={entryY} stroke="#9DB0FF" strokeOpacity="0.7" strokeWidth="1.2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <line x1="0" x2={W} y1={liqY} y2={liqY} stroke="#FF6B6B" strokeOpacity="0.7" strokeWidth="1.2" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {scrub && <line x1={scrub.x} x2={scrub.x} y1="0" y2={H} stroke="white" strokeOpacity="0.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      {showLevels && (
        <>
          <span className="lvl-label" style={{ top: entryY - 11, border: "1px solid rgba(157,176,255,0.8)", color: "var(--peri)" }}>
            {`Entry  ${usd(entry, 0)}`}
          </span>
          <span className="lvl-label" style={{ top: liqY - 11, border: "1px solid rgba(255,107,107,0.8)", color: "var(--coral)" }}>
            {`Liq.  ${usd(liq, 0)}`}
          </span>
        </>
      )}
      {scrub && (
        <>
          <img src={icon("scrubdot")} width={12} height={12} alt="" style={{ position: "absolute", left: `calc(${pctX(scrub.x)} - 6px)`, top: scrub.y - 6 }} />
          <div className="tooltip glass" style={{ left: `clamp(8px, calc(${pctX(scrub.x)} - ${tipW}px), calc(100% - ${tipW + 8}px))` }}>
            <span style={{ color: "#fff" }}>
              {usd(priceAt(scrub.y))} · {timeAt(scrub.x)}
            </span>
            <span className={prices.btc >= priceAt(scrub.y) ? "t-up" : "t-down"}>
              {pct((prices.btc / priceAt(scrub.y) - 1) * 100)} since here
            </span>
          </div>
        </>
      )}
    </div>
  );
}
