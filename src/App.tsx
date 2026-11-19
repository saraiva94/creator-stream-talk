import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { AuthRedirectHandler } from "@/components/AuthRedirectHandler";
import { PWAInstallNotification } from "@/components/PWAInstallNotification";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import PageLoading from "@/components/ui/page-loading";

// Critical route - loaded immediately (first paint)
import Home from "./pages/Home";

// Lazy-loaded routes - code split into separate chunks
const Auth = lazy(() => import("./pages/Auth"));
const Subscribe = lazy(() => import("./pages/Subscribe"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Admin = lazy(() => import("./pages/Admin"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const LiveManagement = lazy(() => import("./pages/LiveManagement"));
const LiveViewer = lazy(() => import("./pages/LiveViewer"));
const CreatorRoom = lazy(() => import("./pages/CreatorRoom"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const CreatorLives = lazy(() => import("./pages/CreatorLives"));
const CreatorHistory = lazy(() => import("./pages/CreatorHistory"));
const CreatorSettings = lazy(() => import("./pages/CreatorSettings"));
const CreatorPayouts = lazy(() => import("./pages/CreatorPayouts"));
const CreatorTags = lazy(() => import("./pages/CreatorTags"));
const AdminCreators = lazy(() => import("./pages/AdminCreators"));
const AdminWithdrawals = lazy(() => import("./pages/AdminWithdrawals"));
const AdminPixWithdrawals = lazy(() => import("./pages/AdminPixWithdrawals"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (was cacheTime)
    },
  },
});

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
            <CreditsProvider>
              <InactivityWrapper>
                <Toaster />
                <Sonner />
                <PWAInstallNotification />
                <AuthRedirectHandler />
                <Suspense fallback={<PageLoading />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/subscribe" element={<Subscribe />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/update-password" element={<UpdatePassword />} />
                    <Route path="/auth/reset-password" element={<ResetPassword />} />
                    <Route path="/invite/:inviteCode" element={<Subscribe />} />
                    <Route path="/invite" element={<Subscribe />} />
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
                    <Route path="/creator/tags" element={
                      <ProtectedRoute>
                        <CreatorTags />
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
                </Suspense>
              </InactivityWrapper>
            </CreditsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
