import React from "react";
import { WifiOff } from "lucide-react";

export const ConnectivityOverlay: React.FC = () => {
  const [online, setOnline] = React.useState<boolean>(true);

  React.useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center bg-yellow-100 px-4 py-3 text-sm text-yellow-900 shadow">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>Connection lost. We’ll retry automatically.</span>
      </div>
    </div>
  );
};

export default ConnectivityOverlay;
