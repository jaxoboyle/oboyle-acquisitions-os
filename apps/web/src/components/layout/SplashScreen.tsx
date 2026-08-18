"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Brief branded splash shown once per real page load (hard refresh, first
// visit, PWA launch) — never on internal client-side navigation, because
// this component lives in the ROOT layout, which the App Router never
// remounts when navigating between pages within the app.
//
// Timing: waits for `window.load` (fonts/images actually painted) so it
// never disappears before the real app is visually ready, but is bounded
// on both ends — a floor so it doesn't flash for fast loads, and a hard
// ceiling so a slow network can never hold the user for "several seconds."
const MIN_VISIBLE_MS = 550;
const MAX_VISIBLE_MS = 1400;
const FADE_MS = 380;

export function SplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let finished = false;

    function beginExit() {
      if (finished) return;
      finished = true;
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(() => {
        setExiting(true);
        window.setTimeout(() => setMounted(false), FADE_MS);
      }, wait);
    }

    if (document.readyState === "complete") {
      beginExit();
    } else {
      window.addEventListener("load", beginExit, { once: true });
    }
    const hardCap = window.setTimeout(beginExit, MAX_VISIBLE_MS);

    return () => {
      window.removeEventListener("load", beginExit);
      window.clearTimeout(hardCap);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className={`splash-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg transition-opacity ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms`, transitionTimingFunction: "ease-in" }}
    >
      <div className="splash-enter flex flex-col items-center gap-4 px-6">
        <Image
          src="/branding/logo-mark.png"
          alt=""
          width={64}
          height={44}
          priority
          className="object-contain"
        />
        <div className="text-center">
          <div className="font-serif font-semibold text-text text-xl sm:text-2xl tracking-[0.08em] uppercase whitespace-nowrap">
            O&apos;Boyle Acquisitions
          </div>
          <div className="divider-brass w-10 mx-auto my-2.5" />
          <div className="label-tech">Acquire · Analyze · Execute</div>
        </div>
      </div>
    </div>
  );
}
