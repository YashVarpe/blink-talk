"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postMessage, speak } from "@/lib/api";
import { useSignals } from "@/lib/useSignals";
import { moveSound, selectSound } from "@/lib/sound";
import { Tile } from "@/lib/Tile";
import { suggestWords } from "@/lib/words";
import { muteListening } from "@/lib/stt";

const GROUPS = ["A–E", "F–J", "K–O", "P–T", "U–Z", "Space / Delete / Speak"];
const lettersOf = (g: string) => (g.includes("Space") ? ["Space", "Delete", "Speak", "Back"] : [...range(g[0], g[2]), "Back"]);
function range(a: string, b: string) { const r: string[] = []; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) r.push(String.fromCharCode(c)); return r; }

export default function Spell() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const textRef = useRef(text); textRef.current = text;

  const last = text.split(" ").pop() ?? "";
  const words = suggestWords(last);
  // Word suggestions appear as extra tiles after the current board's items.
  const items = group ? lettersOf(group).concat(words.map((w) => `→ ${w}`)) : GROUPS;

  const pick = async (i: number = idx) => {
    const it = items[i];
    if (!it) return;
    selectSound();
    if (!group) { setGroup(it); setIdx(0); return; }
    if (it === "Back") { setGroup(null); setIdx(0); return; }
    if (it === "Space") setText((t) => t + " ");
    else if (it === "Delete") setText((t) => t.slice(0, -1));
    else if (it === "Speak") {
      const t = textRef.current.trim();
      if (t) { muteListening(Math.min(10000, 1500 + t.length * 70)); speak(t); await postMessage("user", t); setText(""); router.push("/talk"); }
    } else if (it.startsWith("→ ")) {
      setText((t) => t.slice(0, t.length - last.length) + it.slice(2) + " ");
    } else setText((t) => t + it.toLowerCase());
    setGroup(null); setIdx(0);
  };

  useSignals((e) => {
    if (e.type === "move") { setIdx((i) => (i + e.dir + items.length) % items.length); moveSound(); }
    else if (e.type === "hold") setProgress(e.progress);
    else if (e.type === "select") pick();
    else if (e.type === "undo") { if (group) { setGroup(null); setIdx(0); } else setText((t) => t.slice(0, -1)); }
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 p-6">
      <header className="glass rounded-4xl px-7 py-5">
        <p className="caption">Your message</p>
        <p className="mt-1 min-h-[3.5rem] text-5xl font-semibold tracking-tight">{text || "…"}<span className="animate-pulse text-accent">|</span></p>
        <p className="mt-2 min-h-[2rem] text-2xl text-highlight">{words.length ? `Suggestions: ${words.join("  ·  ")}` : " "}</p>
      </header>
      <section className="grid flex-1 grid-cols-2 gap-5 md:grid-cols-3" aria-label={group ? `Letters ${group}` : "Letter groups"}>
        {items.map((it, i) => (
          <Tile
            key={`${group}-${it}`}
            label={it}
            active={i === idx}
            progress={i === idx ? progress : 0}
            onHover={() => setIdx(i)}
            onPick={() => pick(i)}
          />
        ))}
      </section>
      <footer className="text-center text-muted">Eyebrow raise (U) goes back · Speak sends your message like a tile</footer>
    </main>
  );
}