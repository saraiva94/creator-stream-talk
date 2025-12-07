import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthRedirectHandler } from "@/components/AuthRedirectHandler";
import { PWAInstallNotification } from "@/components/PWAInstallNotification";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Subscribe from "./pages/Subscribe";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import InviteSignup from "./pages/InviteSignup";
import Admin from "./pages/Admin";
import Affiliate from "./pages/Affiliate";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import LiveManagement from "./pages/LiveManagement";
import LiveViewer from "./pages/LiveViewer";
import CreatorRoom from "./pages/CreatorRoom";
import NotFound from "./pages/NotFound";
import AccessDenied from "./pages/AccessDenied";
import CreatorDashboard from "./pages/CreatorDashboard";
import CreatorLives from "./pages/CreatorLives";
import CreatorHistory from "./pages/CreatorHistory";
import CreatorSettings from "./pages/CreatorSettings";
import CreatorPayouts from "./pages/CreatorPayouts";
import AdminCreators from "./pages/AdminCreators";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import AdminPixWithdrawals from "./pages/AdminPixWithdrawals";
import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient();

const InactivityWrapper = ({ children }: { children: React.ReactNode }) => {
  useInactivityLogout();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <InactivityWrapper>
              <Toaster />
              <Sonner />
              <PWAInstallNotification />
              <AuthRedirectHandler />
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/subscribe" element={<Subscribe />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path="/invite/:inviteCode" element={<InviteSignup />} />
                <Route path="/invite" element={<InviteSignup />} />
                <Route path="/u/:username" element={<PublicProfile />} />
                <Route path="/live/:liveId" element={<LiveViewer />} />
                <Route path="/room/:creatorId" element={<CreatorRoom />} />
                <Route path="/access-denied" element={<AccessDenied />} />
                {/* Protected routes - require authentication */}
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/affiliate" element={
                  <ProtectedRoute>
                    <Affiliate />
                  </ProtectedRoute>
                } />
                <Route path="/live-management" element={
                  <ProtectedRoute>
                    <LiveManagement />
                  </ProtectedRoute>
                } />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/creator/dashboard" element={
                  <ProtectedRoute>
                    <CreatorDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/creator/lives" element={
                  <ProtectedRoute>
                    <CreatorLives />
                  </ProtectedRoute>
                } />
                <Route path="/creator/history" element={
                  <ProtectedRoute>
                    <CreatorHistory />
                  </ProtectedRoute>
                } />
                <Route path="/creator/settings" element={
                  <ProtectedRoute>
                    <CreatorSettings />
                  </ProtectedRoute>
                } />
                <Route path="/creator/payouts" element={
                  <ProtectedRoute>
                    <CreatorPayouts />
                  </ProtectedRoute>
                } />

                {/* Admin routes - require authentication + admin role */}
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                } />
                <Route path="/admin/creators" element={
                  <ProtectedRoute requireAdmin>
                    <AdminCreators />
                  </ProtectedRoute>
                } />
                <Route path="/admin/withdrawals" element={
                  <ProtectedRoute requireAdmin>
                    <AdminWithdrawals />
                  </ProtectedRoute>
                } />
                <Route path="/admin/pix-withdrawals" element={
                  <ProtectedRoute requireAdmin>
                    <AdminPixWithdrawals />
                  </ProtectedRoute>
                } />

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </InactivityWrapper>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
