import Link from "next/link";

export default function Calibrate() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="glass flex w-full flex-col items-center gap-5 rounded-4xl px-8 py-12">
        <p className="caption">Step 1 of 1</p>
        <h1 className="font-display text-6xl font-extrabold italic leading-none tracking-tight md:text-7xl">
          Calibration
        </h1>
        <p className="max-w-xl text-xl leading-relaxed text-muted">
          Calibration will teach BlinkTalk how you look left, right and blink. It arrives with the
          eye-tracking module. Until then the keyboard controls work everywhere.
        </p>
        <p className="rounded-full bg-surface px-5 py-2 text-sm text-muted">
          Keys: ← → move · hold Space select · E emergency · R rest · F face
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/talk"
          className="glow rounded-full bg-highlight px-10 py-5 text-2xl font-semibold text-onhighlight shadow-glow"
        >
          Done
        </Link>
        <Link href="/" className="glass glow rounded-full px-8 py-5 text-xl font-medium">
          Back home
        </Link>
      </div>
    </main>
  );
}