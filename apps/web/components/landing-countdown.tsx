"use client";

import { useEffect, useState } from "react";

const LAUNCH_DATE = new Date("2026-03-23T15:00:00Z");

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft | null {
  const diff = LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex size-16 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-2xl font-bold tabular-nums text-white sm:size-20 sm:text-3xl">
        {String(value).padStart(2, "0")}
      </div>
      <span className="mt-2 text-xs uppercase tracking-[0.15em] text-[#555]">{label}</span>
    </div>
  );
}

export function LaunchCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(getTimeLeft());
    const interval = setInterval(() => {
      const tl = getTimeLeft();
      if (!tl) {
        clearInterval(interval);
      }
      setTimeLeft(tl);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {["Days", "Hours", "Min", "Sec"].map((label) => (
          <TimeUnit key={label} value={0} label={label} />
        ))}
      </div>
    );
  }

  if (!timeLeft) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-green-400" />
          </span>
          We are live! Check us out on GitHub
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4" role="timer" aria-live="polite" aria-label={`${timeLeft.days} days, ${timeLeft.hours} hours, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds until launch`}>
      <TimeUnit value={timeLeft.days} label="Days" />
      <span className="mt-[-1rem] text-xl font-light text-white/20">:</span>
      <TimeUnit value={timeLeft.hours} label="Hours" />
      <span className="mt-[-1rem] text-xl font-light text-white/20">:</span>
      <TimeUnit value={timeLeft.minutes} label="Min" />
      <span className="mt-[-1rem] text-xl font-light text-white/20">:</span>
      <TimeUnit value={timeLeft.seconds} label="Sec" />
    </div>
  );
}
