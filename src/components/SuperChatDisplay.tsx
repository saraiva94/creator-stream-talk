import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SuperChat {
  id: string;
  message: string;
  tier: "blue" | "yellow" | "red";
  duration_seconds: number;
  username: string;
  expires_at: string;
}

interface SuperChatDisplayProps {
  superchat: SuperChat;
  onExpire: (id: string) => void;
}

const tierStyles = {
  blue: "bg-blue-500/90 border-blue-400",
  yellow: "bg-yellow-500/90 border-yellow-400", 
  red: "bg-red-500/90 border-red-400",
};

const SuperChatDisplay = ({ superchat, onExpire }: SuperChatDisplayProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const expiresAt = new Date(superchat.expires_at).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        onExpire(superchat.id);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [superchat.expires_at, superchat.id, onExpire]);

  if (timeLeft <= 0) return null;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border-2 animate-pulse shadow-lg",
        tierStyles[superchat.tier]
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-white text-sm">{superchat.username}</span>
        <span className="text-white/80 text-xs">{timeLeft}s</span>
      </div>
      <p className="text-white text-sm">{superchat.message}</p>
    </div>
  );
};

export default SuperChatDisplay;
