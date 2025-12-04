import React from "react";
import { api } from "@/lib/api";

interface CreditsContextValue {
  creditBalance: number;
  refreshCredits: () => Promise<number>;
  consumeLocal: (amount: number) => void;
  setCredits: (amount: number) => void;
}

const CreditsContext = React.createContext<CreditsContextValue | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [creditBalance, setCreditBalance] = React.useState<number>(0);
  const mountedRef = React.useRef(true);

  const refreshCredits = React.useCallback(async () => {
    try {
      const data = await api.credits.balance();
      if (mountedRef.current && typeof data.creditBalance === "number") {
        setCreditBalance(data.creditBalance);
        return data.creditBalance;
      }
    } catch (error) {
      console.debug("[credits] refresh failed", error);
    }
    return creditBalance;
  }, [creditBalance]);

  const consumeLocal = React.useCallback((amount: number) => {
    setCreditBalance((current) => Math.max(0, current - Math.max(0, Math.floor(amount))));
  }, []);

  const setCredits = React.useCallback((amount: number) => {
    setCreditBalance(Math.max(0, Math.floor(amount)));
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    refreshCredits();
    return () => {
      mountedRef.current = false;
    };
  }, [refreshCredits]);

  return (
    <CreditsContext.Provider value={{ creditBalance, refreshCredits, consumeLocal, setCredits }}>
      {children}
    </CreditsContext.Provider>
  );
};

export const useCredits = () => {
  const ctx = React.useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used within CreditsProvider");
  return ctx;
};
