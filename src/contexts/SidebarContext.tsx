import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  toggleExpanded: () => void;
  isVisible: boolean;
  setIsVisible: (value: boolean) => void;
  toggleVisible: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const TABLET_BREAKPOINT = 1024;

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  // Start as hidden on mobile/tablet (will be set correctly on mount)
  const [isVisible, setIsVisible] = useState(() => {
    // SSR safety check
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= TABLET_BREAKPOINT;
  });

  // Set correct initial visibility based on device type on mount
  useEffect(() => {
    const isMobileOrTablet = window.innerWidth < TABLET_BREAKPOINT;
    if (isMobileOrTablet) {
      setIsVisible(false);
    }
  }, []);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);
  const toggleVisible = () => setIsVisible((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ 
      isExpanded, 
      setIsExpanded, 
      toggleExpanded,
      isVisible,
      setIsVisible,
      toggleVisible
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
};
