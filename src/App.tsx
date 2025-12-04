import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Subscribe from "./pages/Subscribe";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import InviteSignup from "./pages/InviteSignup";
import Admin from "./pages/Admin";
import Affiliate from "./pages/Affiliate";
import Profile from "./pages/Profile";
import LiveManagement from "./pages/LiveManagement";
import LiveViewer from "./pages/LiveViewer";
import CreatorRoom from "./pages/CreatorRoom";
import NotFound from "./pages/NotFound";
import CreatorDashboard from "./pages/CreatorDashboard";
import CreatorLives from "./pages/CreatorLives";
import CreatorHistory from "./pages/CreatorHistory";
import CreatorSettings from "./pages/CreatorSettings";
import CreatorPayouts from "./pages/CreatorPayouts";
import AdminCreators from "./pages/AdminCreators";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/invite/:inviteCode" element={<InviteSignup />} />
            <Route path="/invite" element={<InviteSignup />} />
            <Route path="/live-management" element={<LiveManagement />} />
            <Route path="/live/:liveId" element={<LiveViewer />} />
            <Route path="/room/:creatorId" element={<CreatorRoom />} />
            <Route path="/subscribe" element={<Subscribe />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/creators" element={<AdminCreators />} />
            <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
            <Route path="/affiliate" element={<Affiliate />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/creator/dashboard" element={<CreatorDashboard />} />
            <Route path="/creator/lives" element={<CreatorLives />} />
            <Route path="/creator/history" element={<CreatorHistory />} />
            <Route path="/creator/settings" element={<CreatorSettings />} />
            <Route path="/creator/payouts" element={<CreatorPayouts />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
