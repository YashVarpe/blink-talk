"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/** Plain-language result for judges, written in results.json under "highlights". */
type Highlight = { title: string; value: string; unit?: string; detail?: string; how?: string; stage?: string };

function toHighlights(data: Record<string, unknown> | null): Highlight[] {
  const raw = data?.highlights;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (h): h is Highlight => !!h && typeof h === "object" && typeof h.title === "string" && typeof h.value === "string",
  );
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

  const highlights = toHighlights(data);

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

      {(state === "empty" || (state === "ready" && highlights.length === 0)) && (
        <section className="glass rounded-4xl p-8 text-center">
          <p className="text-2xl font-semibold">No results yet</p>
          <p className="mt-2 text-lg text-muted">
            Results appear here once <code>results.json</code> has a <code>highlights</code> list.
          </p>
        </section>
      )}

      {highlights.length > 0 && (
        <section aria-labelledby="highlights" className="flex flex-col gap-4">
          <div className="px-2">
            <h2 id="highlights" className="text-2xl font-semibold tracking-tight">What we measured</h2>
            <p className="mt-1 text-lg text-muted">Real tests on our own app and live server. No estimates.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((h) => (
              <article key={h.title} className="glass glow flex flex-col gap-2 rounded-4xl p-6">
                {h.stage && <p className="caption text-highlight">{h.stage}</p>}
                <h3 className="text-xl font-semibold leading-snug">{h.title}</h3>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-5xl font-semibold tracking-tight text-highlight tabular-nums">{h.value}</span>
                  {h.unit && <span className="text-base text-muted">{h.unit}</span>}
                </p>
                {h.detail && <p className="text-base leading-relaxed">{h.detail}</p>}
                {h.how && <p className="mt-auto pt-2 text-sm text-muted">How we measured: {h.how}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

    </main>
  );
}