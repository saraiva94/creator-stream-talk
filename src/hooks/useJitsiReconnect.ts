import { useCallback, useState } from "react";

type UseJitsiReconnectParams = {
  onRetry: () => Promise<void>;
};

export const useJitsiReconnect = ({ onRetry }: UseJitsiReconnectParams) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = useCallback(async () => {
    setIsRetrying(true);
    setError(null);
    try {
      await onRetry();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao reconectar");
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  return {
    retry,
    isRetrying,
    error,
  };
};
