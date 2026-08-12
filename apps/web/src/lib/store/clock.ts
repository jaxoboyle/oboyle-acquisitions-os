"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";

/**
 * One shared wall-clock tick for the whole app. Every previous version of
 * this had each component start its own `setInterval(1000)`, so multiple
 * independently-drifting timers were live at once and any two could fire
 * within the same render pass. This is the single source of truth: a
 * self-correcting `setTimeout` chain (delay = ms until the next real second
 * boundary, not a fixed 1000ms) that every consumer subscribes to.
 */
const useClockStore = create<{ now: number }>(() => ({ now: Date.now() }));

let timer: ReturnType<typeof setTimeout> | null = null;
let visibilityAttached = false;
let subscriberCount = 0;

function tick() {
  useClockStore.setState({ now: Date.now() });
  scheduleNext();
}

function scheduleNext() {
  if (typeof document !== "undefined" && document.hidden) {
    timer = null;
    return;
  }
  const delay = 1000 - (Date.now() % 1000);
  timer = setTimeout(tick, delay);
}

function start() {
  if (typeof window === "undefined" || timer) return;
  if (!visibilityAttached) {
    visibilityAttached = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } else if (subscriberCount > 0) {
        useClockStore.setState({ now: Date.now() });
        scheduleNext();
      }
    });
  }
  scheduleNext();
}

function stop() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Ticks once per real second from the single shared scheduler above. */
export function useNow(): number {
  useEffect(() => {
    subscriberCount++;
    start();
    return () => {
      subscriberCount--;
      if (subscriberCount <= 0) stop();
    };
  }, []);

  return useClockStore((s) => s.now);
}

/** True once the tab has gone to background — used to pause decorative animation. */
export function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return hidden;
}
