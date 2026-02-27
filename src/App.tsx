import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import FocusPage from "./pages/FocusPage";
import PlanPage from "./pages/PlanPage";
import ReviewPage from "./pages/ReviewPage";
import ArchivePage from "./pages/ArchivePage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground font-sans text-sm">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground font-sans text-sm">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><FocusPage /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
            <Route path="/archive" element={<ProtectedRoute><ArchivePage /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
            {/* Legacy redirects */}
            <Route path="/dashboard" element={<Navigate to="/review" replace />} />
            <Route path="/projects" element={<Navigate to="/review" replace />} />
            <Route path="/kanban" element={<Navigate to="/review" replace />} />
            <Route path="/inbox" element={<Navigate to="/plan" replace />} />
            <Route path="/waiting" element={<Navigate to="/review" replace />} />
            <Route path="/done" element={<Navigate to="/archive" replace />} />
            <Route path="/planner" element={<Navigate to="/plan" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
