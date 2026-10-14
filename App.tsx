import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { StoreProvider, haptic, useStore, type Side } from "./lib";
import Onboarding from "./Onboarding";
import Home from "./Home";
import Asset from "./Asset";
import Trade, { type TradeResult } from "./Trade";
import Success from "./Success";

export type Route =
  | { name: "onb"; step: number }
  | { name: "home" }
  | { name: "asset" }
  | { name: "trade"; side: Side }
  | { name: "success"; r: TradeResult };
type Dir = "push" | "pop" | "modal" | "dismiss" | "fade" | "reveal";

const SAMPLE: TradeResult = { side: "long", lev: 10, amount: 810, entry: 98412.5, origin: { x: 341, y: 778 } };

function parseHash(raw: string = location.hash): Route {
  const h = raw.replace(/^#?\/?/, "");
  if (h === "home") return { name: "home" };
  if (h === "asset") return { name: "asset" };
  if (h === "trade-long") return { name: "trade", side: "long" };
  if (h === "trade-short") return { name: "trade", side: "short" };
  if (h === "success-long") return { name: "success", r: SAMPLE };
  if (h === "success-short") return { name: "success", r: { ...SAMPLE, side: "short" } };
  const m = h.match(/^onboarding-(\d)$/);
  return { name: "onb", step: m ? Math.min(2, Number(m[1]) - 1) : 0 };
}
const hashOf = (r: Route) =>
  r.name === "onb" ? `onboarding-${r.step + 1}` : r.name === "trade" ? `trade-${r.side}` : r.name === "success" ? `success-${r.r.side}` : r.name;

const variants = {
  enter: (d: Dir) =>
    d === "push" ? { x: "100%", zIndex: 2 } : d === "pop" ? { x: "-22%", opacity: 0.5, zIndex: 1 } : d === "modal" ? { y: "100%", zIndex: 2 } : d === "fade" ? { opacity: 0, zIndex: 2 } : { zIndex: d === "dismiss" ? 1 : 2 },
  center: { x: 0, y: 0, opacity: 1 },
  exit: (d: Dir) =>
    d === "push"
      ? { x: "-22%", opacity: 0.5, zIndex: 1 }
      : d === "pop"
        ? { x: "100%", zIndex: 2 }
        : d === "dismiss"
          ? { y: "100%", zIndex: 2 }
          : d === "fade"
            ? { opacity: 0, zIndex: 1 }
            : { opacity: 1, zIndex: 1, transition: { duration: 0.6 } },
};

function Prototype() {
  const { addPosition, setThesis, toast, toastMsg } = useStore();
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [dir, setDir] = useState<Dir>("fade");
  const [homeVisits, setHomeVisits] = useState(0);
  const [thesisFor, setThesisFor] = useState<string | null>(null);
  const [thesis, setThesisText] = useState("");
  const [scale, setScale] = useState(1);

  const go = (r: Route, d: Dir) => {
    setDir(d);
    setRoute(r);
  };

  useEffect(() => {
    const h = "#" + hashOf(route);
    if (location.hash !== h) history.replaceState(null, "", h);
    if (route.name === "home") setHomeVisits((v) => v + 1);
  }, [route]);

  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      if (hashOf(r) !== hashOf(route)) go(r, "fade");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [route]);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 64) / 872));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const confirmTrade = (r: TradeResult) => {
    const id = `btc-${Date.now()}`;
    addPosition({ id, asset: "BTC", name: "Bitcoin", side: r.side, lev: r.lev, margin: r.amount, entry: r.entry });
    setThesisFor(null);
    setThesisText("");
    lastId = id;
    go({ name: "success", r }, "reveal");
  };

  const key = route.name === "onb" ? "onb" : route.name;

  return (
    <div className="stage">
      <div className="device" style={{ transform: `scale(${scale})` }}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={key}
            className="screen-layer"
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 340, damping: 38, mass: 1 }}
          >
            {route.name === "onb" && <Onboarding step={route.step} setStep={(s) => setRoute({ name: "onb", step: s })} onDone={() => go({ name: "home" }, "fade")} />}
            {route.name === "home" && <Home firstVisit={homeVisits <= 1} onOpenAsset={() => go({ name: "asset" }, "push")} />}
            {route.name === "asset" && <Asset onBack={() => go({ name: "home" }, "pop")} onTrade={(side) => go({ name: "trade", side }, "modal")} />}
            {route.name === "trade" && <Trade initialSide={route.side} onClose={() => go({ name: "asset" }, "dismiss")} onConfirm={confirmTrade} />}
            {route.name === "success" && (
              <Success
                r={route.r}
                onDone={() => go({ name: "home" }, "fade")}
                onThesis={() => {
                  haptic(6);
                  setThesisFor(lastId);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {thesisFor !== null && (
            <>
              <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setThesisFor(null)} />
              <motion.div className="sheet" initial={{ y: "110%" }} animate={{ y: 0 }} exit={{ y: "110%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
                <div className="grab" />
                <h3>Your thesis</h3>
                <p className="sub">Why this trade? Followers see it next to your position.</p>
                <textarea autoFocus placeholder="e.g. ETF inflows + post-halving supply…" value={thesis} onChange={(e) => setThesisText(e.target.value)} maxLength={280} />
                <div className="stack">
                  <button
                    className="btn-white pressable"
                    onClick={() => {
                      if (thesisFor && thesis.trim()) setThesis(thesisFor, thesis.trim());
                      setThesisFor(null);
                      toast(thesis.trim() ? "Thesis added" : "No thesis added");
                      go({ name: "home" }, "fade");
                    }}
                  >
                    Save & done
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toastMsg && (
            <motion.div className="toast glass" key={toastMsg} initial={{ opacity: 0, y: 10, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 6, x: "-50%" }}>
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

let lastId = "";

export default function App() {
  return (
    <StoreProvider>
      <Prototype />
    </StoreProvider>
  );
}
