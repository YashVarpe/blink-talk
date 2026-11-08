"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignals } from "@/lib/useSignals";
import { moveSound, selectSound } from "@/lib/sound";
import { Tile } from "@/lib/Tile";

const CHOICES = [
  { label: "Start talking", sub: "Answer with a look and a long blink", href: "/talk" },
  { label: "Calibrate", sub: "Set up your eyes first · about 30 seconds", href: "/calibrate" },
];

export default function Home() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useSignals((e) => {
    if (e.type === "move") {
      setIdx((i) => (i + e.dir + CHOICES.length) % CHOICES.length);
      moveSound();
    } else if (e.type === "hold") {
      setProgress(e.progress);
    } else if (e.type === "select") {
      selectSound();
      router.push(CHOICES[idx].href);
    }
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 p-6 text-center">
      <div className="flex flex-col items-center gap-5">
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a84ff" />
              <stop offset="1" stopColor="#5e5ce6" />
            </linearGradient>
          </defs>
          <rect width="84" height="84" rx="24" fill="url(#g)" />
          <path
            d="M14 42c8-13 18-19 28-19s20 6 28 19c-8 13-18 19-28 19S22 55 14 42z"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <circle cx="42" cy="42" r="9" fill="#fff" />
        </svg>
        <h1 className="text-7xl font-semibold tracking-tight">BlinkTalk</h1>
        <p className="max-w-2xl text-3xl font-medium text-muted">
          Hold a conversation with your eyes.
        </p>
      </div>

      <section className="grid w-full grid-cols-1 gap-5 md:grid-cols-2" aria-label="Start">
        {CHOICES.map((c, i) => (
          <Tile
            key={c.href}
            label={c.label}
            sub={c.sub}
            active={i === idx}
            progress={i === idx ? progress : 0}
          />
        ))}
      </section>

      <nav className="flex flex-wrap items-center justify-center gap-3 text-lg" aria-label="Other views">
        <Link href="/caregiver" className="glass rounded-full px-6 py-3 font-medium">
          Caregiver view
        </Link>
        <Link href="/results" className="glass rounded-full px-6 py-3 font-medium">
          Results
        </Link>
      </nav>

      <p className="flex items-center gap-2 text-base text-muted">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 1l6 2v4c0 4-3 7-6 8-3-1-6-4-6-8V3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        Your camera video never leaves this device. Only text is sent to the server.
      </p>
    </main>
  );
}