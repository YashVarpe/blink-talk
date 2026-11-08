"use client";
import { useEffect, useRef, useState } from "react";
import { getMessages } from "@/lib/api";
import { beep } from "@/lib/sound";
import type { Message, Status } from "@/lib/types";

const STATUS: Record<Status, { label: string; dot: string; pill: string }> = {
  active: { label: "Active", dot: "bg-good", pill: "bg-good/15 text-good" },
  resting: { label: "Resting", dot: "bg-accent", pill: "bg-accent/15 text-accent" },
  face_lost: { label: "Face lost", dot: "bg-warn", pill: "bg-warn/15 text-warn" },
};

export default function Caregiver() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("active");
  const [alert, setAlert] = useState(false);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMessages(20).then((m) => setMessages(m));
    const es = new EventSource("/api/events");
    es.onopen = () => {
      setConnected(true);
      getMessages(20).then((m) => setMessages(m)); // catch up after a locked phone or dropped connection
    };
    es.onerror = () => setConnected(false);
    es.addEventListener("message", (e) => {
      const m: Message = JSON.parse((e as MessageEvent).data);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    es.addEventListener("alert", (e) => {
      const a: { type: string } = JSON.parse((e as MessageEvent).data);
      setAlert(a.type === "emergency");
    });
    es.addEventListener("status", (e) => {
      const s: { state: Status } = JSON.parse((e as MessageEvent).data);
      setStatus(s.state);
    });
    return () => es.close();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!alert || !soundOn) return;
    const t = setInterval(() => beep(880, 300), 700);
    return () => clearInterval(t);
  }, [alert, soundOn]);

  const st = STATUS[status];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 p-6">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-4xl px-7 py-5">
        <div>
          <p className="font-display text-xl font-extrabold italic text-muted">BlinkTalk</p>
          <h1 className="text-3xl font-semibold tracking-tight">Caregiver view</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-base">
          <span className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium ${st.pill}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />Status: {st.label}
          </span>
          <span className={`rounded-full px-4 py-2 font-medium ${connected ? "bg-good/15 text-good" : "bg-danger/15 text-danger"}`}>
            {connected ? "Live" : "Disconnected"}
          </span>
          {!soundOn && (
            <button onClick={() => { setSoundOn(true); beep(660, 120); }} className="glow rounded-full bg-surface2 px-4 py-2 font-medium">
              Enable alert sound
            </button>
          )}
        </div>
      </header>

      {alert && (
        <div role="alertdialog" className="rounded-4xl bg-danger p-7 text-center text-onhighlight shadow-tile">
          <p className="text-5xl font-bold tracking-tight">Emergency</p>
          <p className="mt-2 text-2xl font-medium">The user needs help now.</p>
          <button onClick={() => setAlert(false)} className="glow mt-5 rounded-full bg-black px-8 py-4 text-2xl font-semibold text-white">
            I’m on my way — acknowledge
          </button>
        </div>
      )}

      <section className="glass flex flex-1 flex-col gap-3 overflow-y-auto rounded-4xl p-6" aria-label="Conversation">
        {messages.length === 0 && <p className="text-xl text-muted">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-3xl px-5 py-4 text-2xl ${m.role === "user" ? "self-end bg-highlight text-onhighlight" : "self-start bg-surface2"}`}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-60">
              {m.role === "user" ? "Patient" : "Caregiver"} · {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </section>
    </main>
  );
}