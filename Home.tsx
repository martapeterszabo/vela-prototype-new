import { GlowLine, RollingNumber, type Pt } from "./motion-ui";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssetIcon,
  HomeIndicator,
  StatusBar,
  haptic,
  hero,
  icon,
  pct,
  pnlOf,
  seedPositions,
  signedUsd,
  usd,
  useStore,
  type Position,
} from "./lib";

type Props = { onOpenAsset: () => void; firstVisit: boolean };

const ASSET_STYLE: Record<string, { bg: string; glyph: string }> = {
  BTC: { bg: "#ffaf4f", glyph: "₿" },
  NVDA: { bg: "#76b900", glyph: "N" },
};

// portfolio curve, from the Figma vector (1D) + variants for the other ranges
const PF_SERIES: Record<string, Pt[]> = {
  "1D": [[11.5, 83], [100, 69.5], [192.1, 55.6], [204.1, 44.5], [240.1, 44.5], [290, 31], [334.5, 18.5]],
  "1W": [[11.5, 70], [80, 78], [150, 52], [230, 60], [290, 36], [334.5, 18.5]],
  "1M": [[11.5, 80], [90, 60], [170, 70], [250, 35], [290, 40], [334.5, 18.5]],
  "1Y": [[11.5, 83], [60, 75], [140, 62], [200, 66], [270, 30], [334.5, 18.5]],
  All: [[11.5, 84], [120, 80], [200, 58], [260, 48], [300, 34], [334.5, 18.5]],
};

const TRENDING = [
  { cat: "Crypto", name: "Bitcoin", bg: "#f7931a", glyph: "₿", vol: "$4.1B vol · 24h", price: "$98,412", chg: 2.18, btc: true },
  { cat: "Stocks", name: "NVIDIA", bg: "#76b900", glyph: "N", vol: "$1.9B vol · 24h", price: "$141.20", chg: -0.86 },
  { cat: "Metals", name: "Gold", bg: "#d4af37", glyph: "Au", vol: "$1.2B vol · 24h", price: "$2,654", chg: 1.24 },
  { cat: "Crypto", name: "Ethereum", bg: "#627eea", glyph: "Ξ", vol: "$980M vol · 24h", price: "$3,412", chg: 2.31 },
  { cat: "Stocks", name: "Tesla", bg: "#e31937", glyph: "T", vol: "$870M vol · 24h", price: "$248.51", chg: -1.12 },
  { cat: "Metals", name: "Silver", bg: "#a8b3c7", glyph: "Ag", vol: "$410M vol · 24h", price: "$31.18", chg: 0.94 },
  { cat: "Others", name: "Crude oil", bg: "#3a3f4b", glyph: "CL", vol: "$520M vol · 24h", price: "$71.40", chg: -0.42 },
  { cat: "Others", name: "EUR/USD", bg: "#2f5bd3", glyph: "€", vol: "$310M vol · 24h", price: "$1.0842", chg: 0.12 },
];
const MOVERS = {
  Winners: [
    { name: "Palantir", meta: "PLTR · Stocks", bg: "#00a3e0", glyph: "P", chg: 11.42 },
    { name: "Polkadot", meta: "DOT · Crypto", bg: "#e6007a", glyph: "D", chg: 9.87 },
    { name: "Copper", meta: "HG · Metals", bg: "#b87333", glyph: "Cu", chg: 6.03 },
  ],
  Losers: [
    { name: "Intel", meta: "INTC · Stocks", bg: "#0071c5", glyph: "I", chg: -7.84 },
    { name: "Dogecoin", meta: "DOGE · Crypto", bg: "#c2a633", glyph: "Ð", chg: -6.21 },
    { name: "Natural gas", meta: "NG · Others", bg: "#4b5563", glyph: "NG", chg: -4.66 },
  ],
};

function Seg<T extends string>({ id, items, value, onChange, className = "" }: { id: string; items: T[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={"seg glass " + className}>
      {items.map((it) => (
        <button
          key={it}
          className={it === value ? "on" : ""}
          onClick={() => {
            haptic(4);
            onChange(it);
          }}
        >
          {it === value && <motion.span layoutId={id} className="pill" style={{ inset: 0 }} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span style={{ position: "relative" }}>{it}</span>
        </button>
      ))}
    </div>
  );
}

function VelaRing({ spin, progress }: { spin: boolean; progress: number }) {
  return (
    <motion.svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      animate={spin ? { rotate: 360 } : { rotate: progress * 270 }}
      transition={spin ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0 }}
    >
      <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" fill="none" />
      <circle cx="14" cy="14" r="11" stroke="#0c50ff" strokeWidth="2.5" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${spin ? 0.3 : Math.min(progress, 1) * 0.8} 1`} transform="rotate(-90 14 14)" />
      <circle cx="14" cy="3" r="2.5" fill="#5be3b0" />
    </motion.svg>
  );
}

export default function Home({ onOpenAsset, firstVisit }: Props) {
  const { prices, positions, toast } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // portfolio derived from live PnL relative to the design snapshot
  const basePnl = useMemo(() => seedPositions.reduce((s, p) => s + pnlOf(p, { btc: 98412.5, nvda: 141.2, btcDir: 0, nvdaDir: 0 }), 0), []);
  const livePnl = positions.reduce((s, p) => s + pnlOf(p, prices), 0);
  const extraMargin = positions.filter((p) => !seedPositions.find((s) => s.id === p.id)).reduce((s, p) => s + p.margin, 0);
  const portfolio = 24927.18 + (livePnl - basePnl);
  const today = 412.36 + (livePnl - basePnl);
  const [pfInt, pfDec] = usd(portfolio).split(".");
  const cash = 3240 - extraMargin;

  const [range, setRange] = useState("1D");
  const [news, setNews] = useState([
    { id: "silver", kicker: "NEW ON VELA", title: "Silver is live.", body: "Trade XAG around the clock, up to 20×.", cta: "Trade silver" },
    { id: "ref", kicker: "REFERRALS", title: "Bring a friend.", body: "Earn 30% of their trading fees.", cta: "Invite" },
    { id: "copy", kicker: "SOCIAL", title: "Follow @kova.", body: "Top 1% this month on BTC perps.", cta: "View profile" },
  ]);
  const [page, setPage] = useState(0);
  const [cat, setCat] = useState<"All" | "Stocks" | "Crypto" | "Metals" | "Others">("All");
  const [movers, setMovers] = useState<"Winners" | "Losers">("Winners");
  const [tab, setTab] = useState("Home");

  // pull to refresh
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = scroller.current!;
    const onScroll = () => {
      // hero moves slower than the content (parallax)
      if (heroRef.current) heroRef.current.style.transform = `translate3d(0, ${el.scrollTop * 0.5}px, 0)`;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const [dragging, setDragging] = useState(false);
  const pullStart = (y: number) => {
    if (scroller.current!.scrollTop <= 0 && !refreshing) {
      startY.current = y;
      setDragging(true);
    }
  };
  const pullMove = (y: number) => {
    if (startY.current == null) return;
    const d = y - startY.current;
    if (d > 0 && scroller.current!.scrollTop <= 0) setPull(Math.min(110, d * 0.5));
    else if (d < 0) setPull(0);
  };
  const pullEnd = () => {
    if (startY.current == null) return;
    startY.current = null;
    setDragging(false);
    if (pull > 60) {
      haptic(10);
      setRefreshing(true);
      setPull(60);
      setTimeout(() => {
        setRefreshing(false);
        setPull(0);
        toast("Prices refreshed");
      }, 1300);
    } else setPull(0);
  };

  const totalPnl = positions.reduce((s, p) => s + pnlOf(p, prices), 0);
  const trending = TRENDING.filter((t) => cat === "All" || t.cat === cat).slice(0, 3);

  const dismiss = (id: string) => {
    haptic(6);
    setNews((n) => n.filter((x) => x.id !== id));
    setPage(0);
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", overflow: "hidden" }}>
      <StatusBar />
      <div className="ptr" style={{ opacity: pull > 6 ? 1 : 0, transform: `translateY(${pull * 0.4}px)` }}>
        <VelaRing spin={refreshing} progress={pull / 60} />
      </div>
      <div
        className="scroller"
        ref={scroller}
        onTouchStart={(e) => pullStart(e.touches[0].clientY)}
        onTouchMove={(e) => pullMove(e.touches[0].clientY)}
        onTouchEnd={pullEnd}
        onPointerDown={(e) => e.pointerType === "mouse" && pullStart(e.clientY)}
        onPointerMove={(e) => e.pointerType === "mouse" && pullMove(e.clientY)}
        onPointerUp={(e) => e.pointerType === "mouse" && pullEnd()}
        onPointerLeave={(e) => e.pointerType === "mouse" && pullEnd()}
      >
        <div style={{ transform: `translateY(${pull}px)`, transition: dragging ? "none" : "transform .45s cubic-bezier(.22,1,.36,1)", position: "relative" }}>
          <div className="hero-bg" ref={heroRef}>
            <div className="drift" style={{ position: "absolute", inset: 0 }}>
              <img src={hero("hero-home")} alt="" />
            </div>
          </div>

          <div className="home-content">
            <div className="topbar">
              <button className="avatar pressable" onClick={() => toast("Profile isn’t part of this prototype")}>M</button>
              <button className="search-pill glass pressable" onClick={() => toast("Search isn’t part of this prototype")}>
                <img src={icon("search")} width={18} height={18} alt="" />
                Search
              </button>
              <button className="icon-btn glass" aria-label="Positions" onClick={() => toast("Positions overview isn’t wired")}>
                <img src={icon("positions")} width={20} height={20} alt="" />
              </button>
              <button className="icon-btn" aria-label="Notifications" style={{ width: 40, height: 40 }} onClick={() => toast("1 new notification")}>
                <img src={icon("notif")} width={40} height={40} alt="" />
              </button>
            </div>

            <div className="portfolio">
              <p className="label">Portfolio</p>
              <div className="value">
                <RollingNumber className="int" text={pfInt} intro={firstVisit} dir={prices.btcDir} tint={false} />
                <RollingNumber className="dec" text={"." + pfDec} intro={firstVisit} dir={prices.btcDir} tint={false} />
              </div>
              <div className="chg">
                <div className="pill">
                  <img src={icon("arrowup")} width={10} height={10} alt="" style={{ transform: today < 0 ? "rotate(180deg)" : undefined }} />
                  <RollingNumber text={`${usd(Math.abs(today))} (${((Math.abs(today) / (portfolio - today)) * 100).toFixed(2)}%)`} dir={prices.btcDir} />
                </div>
                <span className="today">Today</span>
              </div>
              <div className="pf-chart">
                <GlowLine pts={PF_SERIES[range]} vbW={353} vbH={85} drawKey={range} color="#3DD68C" highlight="#B9FFE0" areaOpacity={0.35} strokeWidth={1.8} />
              </div>
              <div className="ranges">
                {["1D", "1W", "1M", "1Y", "All"].map((r) => (
                  <button key={r} className={r === range ? "on" : ""} onClick={() => setRange(r)}>
                    {r === range && <motion.span layoutId="pf-range" className="pill" style={{ left: 0 }} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                    <span style={{ position: "relative" }}>{r}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="cash-card glass">
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="lbl">Available cash</span>
                  <span className="amt">{usd(cash)}</span>
                </div>
                <img src={icon("info")} width={20} height={20} alt="" />
              </div>
              <div className="btns">
                <button className="deposit pressable" onClick={() => toast("Deposit flow isn’t part of this prototype")}>
                  <img src={icon("plus")} width={18} height={18} alt="" /> Deposit
                </button>
                <button className="invite pressable" onClick={() => toast("Invite link copied")}>
                  <img src={icon("gift")} width={18} height={18} alt="" /> Invite
                </button>
              </div>
            </div>

            <div className="section">
              <div className="open-head">
                <h2>Open trades</h2>
                <span className={totalPnl >= 0 ? "t-up" : "t-down"}>
                  {positions.length} open · <RollingNumber text={signedUsd(totalPnl)} dir={prices.btcDir} />
                </span>
              </div>
              <div className="list">
                <AnimatePresence initial={false}>
                  {positions.map((p, i) => (
                    <PositionRow key={p.id} p={p} first={i === 0} onClick={() => (p.asset === "BTC" ? onOpenAsset() : toast("Only Bitcoin is wired in this prototype"))} />
                  ))}
                </AnimatePresence>
                {positions.length === 0 && <p className="empty">No open trades</p>}
              </div>
            </div>

            {news.length > 0 && (
              <div className="section">
                <motion.div
                  className="carousel"
                  layout
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setPage(Math.round(el.scrollLeft / 312));
                  }}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {news.map((n) => (
                      <motion.div
                        key={n.id}
                        layout
                        className="news-card"
                        initial={false}
                        exit={{ opacity: 0, scale: 0.9, width: 0, marginRight: -12, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
                        style={{
                          background:
                            n.id === "silver"
                              ? "linear-gradient(130.44deg, #1f49e0 0%, #0a1a5c 66.667%)"
                              : n.id === "ref"
                                ? "linear-gradient(130.44deg, #2a2f55 0%, #111a33 66.667%)"
                                : "linear-gradient(130.44deg, #0f3a3a 0%, #111a33 66.667%)",
                        }}
                      >
                        {n.id === "silver" && <img className="bgimg" src={hero("news-silver")} alt="" style={{ left: -1, top: -1, width: 300, height: 176 }} />}
                        {n.id === "ref" &&
                          [0, 1, 2, 3, 4, 5, 6].map((k) => <img key={k} src={icon("ellipse")} alt="" style={{ position: "absolute", width: 120, height: 46, left: 225 - k * 4, top: 117 - k * 16 }} />)}
                        <span className="kicker">{n.kicker}</span>
                        <span className="title">{n.title}</span>
                        <span className="body">{n.body}</span>
                        <button className="cta pressable" onClick={() => toast(`${n.cta} isn’t part of this prototype`)}>
                          {n.cta}
                        </button>
                        <button className="x glass" aria-label="Dismiss" onClick={() => dismiss(n.id)}>
                          <img src={icon("close")} width={12} height={12} alt="" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
                <div className="dots">
                  {news.map((n, i) => (
                    <i key={n.id} className={i === Math.min(page, news.length - 1) ? "on" : ""} />
                  ))}
                </div>
              </div>
            )}

            <button className="featured pressable" onClick={() => toast("Only Bitcoin is wired in this prototype")}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
                <AssetIcon bg="#d4af37" glyph="Au" color="#2a1e00" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="t-name" style={{ fontSize: 17 }}>Gold</span>
                    <span className="tag">FEATURED</span>
                  </div>
                  <span className="t-meta">XAU · Metals · up to 20×</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, fontWeight: 700 }}>
                  <span style={{ fontSize: 17, color: "#fff" }}>$2,654.20</span>
                  <span className="t-up" style={{ fontSize: 13 }}>+1.24%</span>
                </div>
              </div>
              <div className="spark-gold">
                <img src={icon("gold-fill")} alt="" style={{ left: 0, right: 0, top: "5.71%", bottom: 0, width: "100%", height: "94.29%" }} />
                <img src={icon("gold-line")} alt="" style={{ left: "-0.32%", top: "4.79%", width: "100.64%", height: "91.4%" }} />
              </div>
              <div className="social">
                <img src={icon("avatars")} width={50} height={22} alt="" />
                1,240 traders went long this week
              </div>
            </button>

            <div className="section">
              <div className="section-head">
                <h2>Watchlist</h2>
                <button className="link" onClick={() => toast("Edit watchlist isn’t wired")}>Edit</button>
              </div>
              <div className="list tight">
                {[
                  { name: "Ethereum", tk: "ETH", bg: "#627eea", g: "Ξ", sp: "spark-eth", price: "$3,412.08", chg: 2.31 },
                  { name: "Tesla", tk: "TSLA", bg: "#e31937", g: "T", sp: "spark-tsla", price: "$248.51", chg: -1.12 },
                  { name: "Solana", tk: "SOL", bg: "#9945ff", g: "S", sp: "spark-sol", price: "$184.77", chg: 5.08 },
                ].map((w, i) => (
                  <div key={w.name} style={{ display: "contents" }}>
                    {i > 0 && <div className="divider" />}
                    <button className="row" onClick={() => toast("Only Bitcoin is wired in this prototype")}>
                      <AssetIcon bg={w.bg} glyph={w.g} />
                      <div className="grow">
                        <span className="t-name">{w.name}</span>
                        <span className="t-meta">{w.tk}</span>
                      </div>
                      <img src={icon(w.sp)} width={64} height={26} alt="" />
                      <div className="end" style={{ width: 84 }}>
                        <span className="t-price">{w.price}</span>
                        <span className={(w.chg >= 0 ? "t-up" : "t-down") + " nowrap"} style={{ fontWeight: 700, fontSize: 12 }}>
                          {pct(w.chg)}
                        </span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="section">
              <div className="section-head">
                <h2>Trending</h2>
                <button className="link" onClick={() => toast("Markets tab isn’t part of this prototype")}>See all</button>
              </div>
              <LayoutGroup id="trend">
                <Seg id="trend-pill" items={["All", "Stocks", "Crypto", "Metals", "Others"] as const as unknown as ("All" | "Stocks" | "Crypto" | "Metals" | "Others")[]} value={cat} onChange={setCat} className="full" />
              </LayoutGroup>
              <div className="list tight">
                <AnimatePresence mode="popLayout" initial={false}>
                  {trending.map((t, i) => (
                    <motion.div key={t.name} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ width: "100%" }}>
                      {i > 0 && <div className="divider" />}
                      <button className="row" onClick={() => (t.btc ? onOpenAsset() : toast("Only Bitcoin is wired in this prototype"))}>
                        <span className="rank">{i + 1}</span>
                        <AssetIcon bg={t.bg} glyph={t.glyph} />
                        <div className="grow">
                          <span className="t-name">{t.name}</span>
                          <span className="t-meta">{t.vol}</span>
                        </div>
                        <div className="end">
                          <span className="t-price">{t.btc ? <RollingNumber text={usd(prices.btc, 0)} dir={prices.btcDir} /> : t.price}</span>
                          <span className={t.chg >= 0 ? "t-up" : "t-down"} style={{ fontWeight: 700, fontSize: 12 }}>
                            {pct(t.btc ? ((prices.btc - 96308.2) / 96308.2) * 100 : t.chg)}
                          </span>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="section">
              <div className="section-head">
                <h2>Today’s movers</h2>
                <LayoutGroup id="movers">
                  <Seg id="movers-pill" items={["Winners", "Losers"] as ("Winners" | "Losers")[]} value={movers} onChange={setMovers} />
                </LayoutGroup>
              </div>
              <div className="list tight">
                <AnimatePresence mode="popLayout" initial={false}>
                  {MOVERS[movers].map((m, i) => (
                    <motion.div key={m.name} initial={{ opacity: 0, x: movers === "Winners" ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }} style={{ width: "100%" }}>
                      {i > 0 && <div className="divider" />}
                      <button className="row" onClick={() => toast("Only Bitcoin is wired in this prototype")}>
                        <AssetIcon bg={m.bg} glyph={m.glyph} />
                        <div className="grow">
                          <span className="t-name">{m.name}</span>
                          <span className="t-meta">{m.meta}</span>
                        </div>
                        <span className={"mover-chip " + (m.chg >= 0 ? "up" : "down")}>{pct(m.chg)}</span>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-fade" />
      <LayoutGroup id="tabs">
        <nav className="tabbar glass">
          {[
            ["Home", "tab-home"],
            ["Markets", "tab-markets"],
            ["Leaders", "tab-leaders"],
            ["Profile", "tab-profile"],
          ].map(([t, ic]) => (
            <button
              key={t}
              className={tab === t ? "on" : ""}
              onClick={() => {
                haptic(4);
                setTab(t);
                if (t !== "Home") {
                  toast(`${t} isn’t part of this prototype`);
                  setTimeout(() => setTab("Home"), 700);
                } else scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {tab === t && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <img src={icon(ic)} alt="" style={{ opacity: tab === t ? 1 : 0.85 }} />
              {t}
            </button>
          ))}
        </nav>
      </LayoutGroup>
      <HomeIndicator />
    </div>
  );
}

function PositionRow({ p, first, onClick }: { p: Position; first: boolean; onClick: () => void }) {
  const { prices } = useStore();
  const pnl = pnlOf(p, prices);
  const st = ASSET_STYLE[p.asset];
  const dir = p.asset === "BTC" ? prices.btcDir : prices.nvdaDir;
  const signedDir = (p.side === "long" ? dir : -dir) as 1 | -1 | 0;
  return (
    <motion.div layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ width: "100%", overflow: "hidden" }}>
      {!first && <div className="divider" />}
      <button className="row" onClick={onClick}>
        <AssetIcon bg={st.bg} glyph={st.glyph} fontSize={16.8} />
        <div className="grow">
          <span className="t-name">{p.name}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className={"badge " + p.side}>
              {p.side === "long" ? "Long" : "Short"} {p.lev}×
            </span>
            <span className="t-meta">{usd(p.margin, 0)} margin</span>
          </div>
        </div>
        <div className="end">
          <span className={pnl >= 0 ? "t-up" : "t-down"} style={{ fontWeight: 700, fontSize: 16 }}>
            <RollingNumber text={signedUsd(pnl)} dir={signedDir} />
          </span>
          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--muted-2)" }}>{pct((pnl / p.margin) * 100)}</span>
        </div>
      </button>
    </motion.div>
  );
}
