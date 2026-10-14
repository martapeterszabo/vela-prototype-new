import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import globe from "./globe.svg?raw";
import pie from "./pie.svg?raw";
import crown from "./crown.svg?raw";
import { haptic, icon } from "./lib";
import { RollingNumber } from "./motion-ui";

const SLIDE_MS = 7000;
const LEVS = [2, 5, 10, 20];

type Props = { step: number; setStep: (n: number) => void; onDone: () => void };

export default function Onboarding({ step, setStep, onDone }: Props) {
  const [lev, setLev] = useState(10);

  // story-style progress: the active bar fills, then auto-advances (not on the last slide)
  useEffect(() => {
    if (step >= 2) return;
    const id = setTimeout(() => setStep(step + 1), SLIDE_MS);
    return () => clearTimeout(id);
  }, [step, setStep]);

  const next = () => {
    haptic(8);
    if (step < 2) setStep(step + 1);
    else onDone();
  };

  const illus = [
    { svg: globe, top: 145 },
    { svg: pie, top: 185 },
    { svg: crown, top: 24.95 },
  ][step];

  return (
    <div className="onb">
      <div className="progress" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div className="bar" key={i}>
            <div
              key={`${i}-${step}`}
              className="fill"
              style={
                i < step
                  ? { width: "100%" }
                  : i === step
                    ? step === 2
                      ? { width: "35%", transition: "width .6s ease" }
                      : { animation: `onb-fill ${SLIDE_MS}ms linear forwards` }
                    : { width: 0 }
              }
            />
          </div>
        ))}
      </div>
      <style>{`@keyframes onb-fill { from { width: 0 } to { width: 100% } }`}</style>

      {step < 2 ? (
        <button className="skip" onClick={onDone}>
          Skip
        </button>
      ) : (
        <button className="back" onClick={() => setStep(1)} aria-label="Back">
          <img src={icon("chev-left")} width={20} height={20} alt="" />
        </button>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`illus-${step}`}
          className="illus"
          style={{ top: illus.top }}
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.04, y: -8 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          dangerouslySetInnerHTML={{ __html: illus.svg }}
        />
      </AnimatePresence>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`copy-${step}`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          {step === 0 && (
            <>
              <div className="copy" style={{ left: 30, bottom: 166 }}>
                <h1>
                  Every market.<span>One balance.</span>
                </h1>
                <p className="lede" style={{ maxWidth: 296 }}>Stocks, crypto and metals, tradable around the clock.</p>
              </div>
            </>
          )}
          {step === 1 && (
            <div className="copy" style={{ left: 26, right: 26, bottom: 154, pointerEvents: "auto" }}>
              <h1>
                Amplify<span>your position.</span>
              </h1>
              <p className="lede" style={{ marginTop: 19 }}>
                $100 margin controls&nbsp; <b><RollingNumber text={"$" + (100 * lev).toLocaleString("en-US").replace(",", "\u202f")} tint={false} /></b>. Long or short.
              </p>
              <div className="lev-row" role="tablist" aria-label="Leverage example">
                <i className="ind" style={{ transform: `translateX(${LEVS.indexOf(lev) * 100}%)` }} />
                {LEVS.map((l) => (
                  <button
                    key={l}
                    className={l === lev ? "on" : ""}
                    onClick={() => {
                      haptic(4);
                      setLev(l);
                    }}
                  >
                    {l}×
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="copy" style={{ left: 24, bottom: 166 }}>
              <h1>
                Trade alongside<span>the best.</span>
              </h1>
              <p className="lede">Follow top traders and see their positions live.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <button className="cta pressable" onClick={next} style={step === 1 ? { bottom: 59 } : undefined}>
        {step === 2 ? "Create account" : "Continue"}
      </button>
      {step !== 1 && (
        <button className="secondary" onClick={onDone}>
          {step === 0 ? "I already have an account" : "Log in"}
        </button>
      )}
    </div>
  );
}
