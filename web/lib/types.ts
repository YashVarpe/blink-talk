
export type Role = "user" | "caregiver";
export type Message = { id: string; role: Role; text: string; ts: string };
export type Profile = { name: string; caregivers: string[]; needs: string[]; preferences: string[]; commonPhrases: string[] };
export type Status = "active" | "resting" | "face_lost";
export type SuggestResponse = { phrases: string[]; source: "gemini" | "fallback" };