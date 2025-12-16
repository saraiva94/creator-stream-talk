import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

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

const tierConfig = {
  blue: {
    bg: "bg-blue-500/90",
    border: "border-blue-400/50",
    progressBg: "bg-blue-300/30",
    progressFill: "bg-blue-300",
    icon: "text-blue-200",
  },
  yellow: {
    bg: "bg-amber-500/90",
    border: "border-amber-400/50",
    progressBg: "bg-amber-300/30",
    progressFill: "bg-amber-200",
    icon: "text-amber-200",
  },
  red: {
    bg: "bg-red-500/90",
    border: "border-red-400/50",
    progressBg: "bg-red-300/30",
    progressFill: "bg-red-200",
    icon: "text-red-200",
  },
};

const SuperChatDisplay = ({ superchat, onExpire }: SuperChatDisplayProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(superchat.duration_seconds);
  const [progress, setProgress] = useState<number>(100);

  const totalDuration = useMemo(() => superchat.duration_seconds, [superchat.duration_seconds]);

  useEffect(() => {
    const expiresAt = new Date(superchat.expires_at).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, expiresAt - now);
      const remainingSec = Math.floor(remainingMs / 1000);
      
      setTimeLeft(remainingSec);
      setProgress((remainingMs / (totalDuration * 1000)) * 100);
      
      if (remainingSec <= 0) {
        onExpire(superchat.id);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100); // Update more frequently for smooth progress
    return () => clearInterval(interval);
  }, [superchat.expires_at, superchat.id, onExpire, totalDuration]);

  if (timeLeft <= 0) return null;

  const tier = tierConfig[superchat.tier];

  return (
    <div className="w-full animate-in slide-in-from-bottom-2 duration-300">
      <div
        className={cn(
          "relative w-full rounded-full border backdrop-blur-sm overflow-hidden",
          tier.bg,
          tier.border
        )}
      >
        {/* Content */}
        <div className="px-4 py-2.5 flex items-center gap-3">
          {/* Tier icon */}
          <Sparkles className={cn("h-4 w-4 flex-shrink-0", tier.icon)} />
          
          {/* Username and message */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm truncate">
                {superchat.username}
              </span>
              <span className="text-white/70 text-xs flex-shrink-0">
                {timeLeft}s
              </span>
            </div>
            <p className="text-white/90 text-sm truncate">{superchat.message}</p>
          </div>
        </div>

        {/* Progress bar at bottom - subtle */}
        <div className={cn("absolute bottom-0 left-0 right-0 h-1", tier.progressBg)}>
          <div
            className={cn("h-full transition-all duration-100 ease-linear", tier.progressFill)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default SuperChatDisplay;
