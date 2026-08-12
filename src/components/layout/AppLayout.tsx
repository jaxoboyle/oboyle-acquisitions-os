import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { Toaster } from "@/components/ui/Toaster";

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute right-3 top-2 z-10">
          <ThemeToggle />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
