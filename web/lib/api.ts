import type { Message, Profile, Role, SuggestResponse, Status } from "./types";

async function req(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(path, { ...init, signal: ctl.signal });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r;
  } finally { clearTimeout(t); }
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function localIso(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
  );
}
export const DEFAULT_PHRASES = ["Yes", "No", "I need help", "I'm in pain", "Thank you", "Water please"];

/** Returns null on failure/timeout so the UI keeps its current tiles. */
export async function suggest(transcript: string | null, history: Message[]): Promise<SuggestResponse | null> {
  try {
    const r = await req("/api/suggest", json({ transcript, history, localTime: localIso() }), 5000);
    return await r.json();
  } catch { return null; }
}

/** Speaks text: ElevenLabs via backend, falls back to browser speechSynthesis. */
export async function speak(text: string): Promise<void> {
  try {
    const r = await req("/api/speak", json({ text }), 5000);
    const url = URL.createObjectURL(await r.blob());
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}

export async function postMessage(role: Role, text: string): Promise<Message | null> {
  try { return await (await req("/api/messages", json({ role, text }), 5000)).json(); } catch { return null; }
}
export async function getMessages(limit = 20): Promise<Message[]> {
  try { return await (await req(`/api/messages?limit=${limit}`, { method: "GET" }, 5000)).json(); } catch { return []; }
}
export async function postAlert(type: "emergency" | "emergency_cancelled"): Promise<void> {
  try { await req("/api/alert", json({ type }), 5000); } catch { /* retry is UI's job */ }
}
export async function postStatus(state: Status): Promise<void> {
  try { await req("/api/status", json({ state }), 5000); } catch { /* non-critical */ }
}
export async function getProfile(): Promise<Profile | null> {
  try { return await (await req("/api/profile", { method: "GET" }, 5000)).json(); } catch { return null; }
}
export async function putProfile(p: Profile): Promise<Profile | null> {
  try { return await (await req("/api/profile", { ...json(p), method: "PUT" }, 5000)).json(); } catch { return null; }
}
export async function health(): Promise<boolean> {
  try { return (await (await req("/api/health", { method: "GET" }, 5000)).json()).ok === true; } catch { return false; }
}