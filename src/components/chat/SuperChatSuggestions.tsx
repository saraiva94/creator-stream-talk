import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SuperChatSuggestionsProps {
  onSelect: (tier: "blue" | "yellow" | "red") => void;
}

const TIERS = [
  { tier: "blue" as const, amount: 3, duration: 1, color: "bg-blue-500 hover:bg-blue-600 border-blue-400" },
  { tier: "yellow" as const, amount: 5, duration: 2, color: "bg-yellow-500 hover:bg-yellow-600 border-yellow-400" },
  { tier: "red" as const, amount: 8, duration: 3, color: "bg-red-500 hover:bg-red-600 border-red-400" },
];

export const SuperChatSuggestions = ({ onSelect }: SuperChatSuggestionsProps) => {
  const [displayIndex, setDisplayIndex] = useState<number[]>([0, 0, 0]); // Track which value to show for each tier

  // Cycle between amount and duration every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayIndex((prev) => prev.map((idx) => (idx + 1) % 2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 py-1.5">
      {TIERS.map((tierData, i) => {
        const showDuration = displayIndex[i] === 1;
        return (
          <Button
            key={tierData.tier}
            type="button"
            size="sm"
            onClick={() => onSelect(tierData.tier)}
            className={cn(
              "h-6 px-2 text-[10px] font-semibold text-white border transition-all duration-300",
              tierData.color
            )}
          >
            {showDuration ? `${tierData.duration}min` : `R$${tierData.amount}`}
          </Button>
        );
      })}
    </div>
  );
};
