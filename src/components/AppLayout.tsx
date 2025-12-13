import { ReactNode } from "react";
import Navbar from "./Navbar";
import { ChannelsSidebar } from "./ChannelsSidebar";
import { BlockedUserOverlay } from "./BlockedUserOverlay";
import { GlobalChatButton } from "./GlobalChatButton";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";
import { useIsMobileOrTablet } from "@/hooks/useDeviceType";

interface AppLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

const AppLayoutInner = ({ children, showSidebar = true }: AppLayoutProps) => {
  const { user, isLoading, isBlocked, blockedReason, isAdmin } = useAuth();
  const { isExpanded, isVisible } = useSidebarContext();
  const isMobileOrTablet = useIsMobileOrTablet();

  // Force collapsed on mobile/tablet, and respect visibility toggle
  const effectiveExpanded = isMobileOrTablet ? false : isExpanded;
  const effectiveVisible = isMobileOrTablet ? isVisible : true; // Desktop always visible
  const sidebarWidth = showSidebar 
    ? (effectiveVisible ? (effectiveExpanded ? "ml-60" : "ml-14") : "ml-0") 
    : "";

  // Show blocked overlay if user is banned
  if (isBlocked && user) {
    return <BlockedUserOverlay blockedReason={blockedReason} />;
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <Navbar user={user} isAdmin={isAdmin} />
      {/* Spacer for fixed navbar */}
      <div className="h-16" />
      {showSidebar && <ChannelsSidebar />}
      <main className={`${sidebarWidth} transition-all duration-300 ease-in-out min-h-screen pb-20`}>
        {children}
      </main>
      
      {/* Global Chat Button - Bottom Right Corner */}
      <GlobalChatButton user={user} />
    </div>
  );
};

export const AppLayout = ({ children, showSidebar = true }: AppLayoutProps) => {
  return (
    <SidebarProvider>
      <AppLayoutInner showSidebar={showSidebar}>{children}</AppLayoutInner>
    </SidebarProvider>
  );
};
