import React from "react";
import { Hourglass } from "lucide-react";

interface CreditRemainingOverlayProps {
  creditsLeft: number;
  className?: string;
}

const formatTime = (credits: number) => {
  const totalSeconds = Math.max(0, Math.floor(credits * 10));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const CreditRemainingOverlay: React.FC<CreditRemainingOverlayProps> = ({ creditsLeft, className }) => {
  return (
    <div
      className={`pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-sm font-medium shadow ${className ?? ""}`.trim()}
    >
      <Hourglass className="h-4 w-4 text-primary" />
      <span>
        Credits left: {Math.max(0, Math.floor(creditsLeft))} | Time remaining: {formatTime(creditsLeft)}
      </span>
    </div>
  );
};

export default CreditRemainingOverlay;
