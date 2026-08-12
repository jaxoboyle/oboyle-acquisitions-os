"use client";

import dynamic from "next/dynamic";

// Code-split off the main bundle — the watch face (SVG + Zustand store +
// clock subscriptions) is decorative relative to page content and shouldn't
// block or bloat the initial JS for pages that only need it below the fold.
const Watch = dynamic(() => import("./Watch").then((m) => m.Watch), {
  ssr: false,
  loading: () => <WatchSkeleton />,
});

const WorkdayProgressBar = dynamic(
  () => import("./WorkdayProgressBar").then((m) => m.WorkdayProgressBar),
  { ssr: false, loading: () => <div className="h-16 w-full max-w-md rounded bg-bg-muted animate-pulse" /> }
);

function WatchSkeleton() {
  return <div className="rounded-full bg-bg-muted animate-pulse" style={{ width: 128, height: 128 }} />;
}

export function WatchPanel({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <Watch size={size} />
      <WorkdayProgressBar />
    </div>
  );
}
