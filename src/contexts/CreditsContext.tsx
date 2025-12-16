import React from "react";
import { fetchCreditsBalance } from "@/lib/supabaseApi";

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
  const lastKnownBalanceRef = React.useRef<number>(0);

  const refreshCredits = React.useCallback(async () => {
    try {
      const data = await fetchCreditsBalance();
      const next =
        typeof data.balance_credits === "number"
          ? data.balance_credits
          : typeof data.creditBalance === "number"
            ? data.creditBalance
            : 0;

      if (mountedRef.current) {
        lastKnownBalanceRef.current = Math.max(0, Math.floor(next));
        setCreditBalance(lastKnownBalanceRef.current);
      }

      return lastKnownBalanceRef.current;
    } catch (error) {
      console.debug("[credits] refresh failed", error);
      return lastKnownBalanceRef.current;
    }
  }, []);

  const consumeLocal = React.useCallback((amount: number) => {
    setCreditBalance((current) => {
      const next = Math.max(0, current - Math.max(0, Math.floor(amount)));
      lastKnownBalanceRef.current = next;
      return next;
    });
  }, []);

  const setCredits = React.useCallback((amount: number) => {
    const next = Math.max(0, Math.floor(amount));
    lastKnownBalanceRef.current = next;
    setCreditBalance(next);
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

