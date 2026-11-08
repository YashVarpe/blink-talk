"use client";
import { motion } from "framer-motion";

type Props = { label: string; active: boolean; flash?: boolean; progress: number; sub?: string };

export function Tile({ label, active, flash, progress, sub }: Props) {
  const C = 2 * Math.PI * 22; // ring circumference
  const style = flash
    ? "bg-good text-onhighlight"
    : active
    ? "bg-highlight text-onhighlight shadow-glow"
    : "bg-surface2 text-ink shadow-tile";
  return (
    <motion.div
      aria-current={active}
      animate={{ scale: active ? 1.03 : 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={`glow relative flex min-h-[150px] flex-col items-center justify-center rounded-4xl p-6 text-center text-3xl font-semibold leading-tight tracking-tight transition-colors duration-150 md:text-4xl ${style}`}
    >
      <span>{label}</span>
      {sub && <span className="mt-2 text-base font-normal opacity-75">{sub}</span>}
      {active && (
        <svg className="absolute right-4 top-4" width="52" height="52" viewBox="0 0 56 56" role="img" aria-label={`Hold progress ${Math.round(progress * 100)}%`}>
          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(29,43,48,.2)" strokeWidth="6" />
          <circle cx="28" cy="28" r="22" fill="none" stroke="#1d2b30" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 28 28)" />
        </svg>
      )}
      {active && <span className="absolute bottom-3 left-5 text-xs font-semibold uppercase tracking-widest opacity-70">Hold blink to select</span>}
    </motion.div>
  );
}