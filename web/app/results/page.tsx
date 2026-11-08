"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Stat = { label: string; text: string; ratio: number | null };
type Group = { title: string; stats: Stat[] };

const pretty = (k: string) =>
  k.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

// Only draw a bar for values that clearly are 0..1 rates.
const RATE_KEY = /(rate|accuracy|precision|recall|f1|score|ratio)$/i;

function toStat(key: string, v: unknown): Stat | null {
  if (typeof v === "number") {
    const isRate = RATE_KEY.test(key) && v >= 0 && v <= 1;
    return {
      label: pretty(key),
      text: isRate ? `${Math.round(v * 1000) / 10}%` : Number.isInteger(v) ? String(v) : v.toFixed(2),
      ratio: isRate ? v : null,
    };
  }
  if (typeof v === "string" || typeof v === "boolean") return { label: pretty(key), text: String(v), ratio: null };
  return null;
}

function toGroups(data: Record<string, unknown>): Group[] {
  const summary: Stat[] = [];
  const groups: Group[] = [];
  for (const [k, v] of Object.entries(data)) {
    const s = toStat(k, v);
    if (s) summary.push(s);
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      const stats = Object.entries(v as Record<string, unknown>)
        .map(([k2, v2]) => toStat(k2, v2))
        .filter((x): x is Stat => x !== null);
      if (stats.length) groups.push({ title: pretty(k), stats });
    }
  }
  return summary.length ? [{ title: "Summary", stats: summary }, ...groups] : groups;
}

export default function Results() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    fetch("/results.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no results"))))
      .then((j) => {
        setData(j && typeof j === "object" ? j : null);
        setState(j && typeof j === "object" ? "ready" : "empty");
      })
      .catch(() => setState("empty"));
  }, []);

  const groups = data ? toGroups(data) : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 p-6">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-4xl px-7 py-5">
        <div>
          <p className="font-display text-xl font-extrabold italic text-muted">BlinkTalk</p>
          <h1 className="text-3xl font-semibold tracking-tight">Results</h1>
        </div>
        <Link href="/" className="glass glow rounded-full px-6 py-3 font-medium">
          Back home
        </Link>
      </header>

      {state === "loading" && <p className="text-xl text-muted">Loading results…</p>}

      {state === "empty" && (
        <section className="glass rounded-4xl p-8 text-center">
          <p className="text-2xl font-semibold">No results yet</p>
          <p className="mt-2 text-lg text-muted">
            Results appear here once <code>results.json</code> is available at the site root.
          </p>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.title} className="glass rounded-4xl p-6" aria-label={g.title}>
          <p className="caption mb-4">{g.title}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.stats.map((s) => (
              <div key={s.label} className="glow rounded-3xl bg-surface2 p-5">
                <p className="caption">{s.label}</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight">{s.text}</p>
                {s.ratio !== null && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${s.label} ${s.text}`}>
                    <div className="h-full rounded-full bg-highlight" style={{ width: `${Math.round(s.ratio * 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {data && (
        <details className="glass rounded-4xl p-6">
          <summary className="cursor-pointer text-lg font-medium">Raw data</summary>
          <pre className="mt-4 overflow-x-auto text-sm text-muted">{JSON.stringify(data, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}