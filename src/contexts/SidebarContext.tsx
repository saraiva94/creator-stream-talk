import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  toggleExpanded: () => void;
  isVisible: boolean;
  setIsVisible: (value: boolean) => void;
  toggleVisible: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

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
