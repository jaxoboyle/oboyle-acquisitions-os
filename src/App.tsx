import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Pipeline } from "@/pages/Pipeline";
import { DealTracker } from "@/pages/DealTracker";
import { Buyers } from "@/pages/Buyers";
import { Tasks } from "@/pages/Tasks";
import { Settings } from "@/pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/deals" element={<DealTracker />} />
              <Route path="/buyers" element={<Buyers />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
