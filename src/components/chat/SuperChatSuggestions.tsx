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
  // Cycle through 3 states: 0 = amount, 1 = duration, 2 = "SuperChat"
  const [displayIndex, setDisplayIndex] = useState<number[]>([0, 0, 0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayIndex((prev) => prev.map((idx) => (idx + 1) % 3));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getDisplayText = (tierData: typeof TIERS[0], idx: number) => {
    switch (idx) {
      case 0:
        return `R$${tierData.amount}`;
      case 1:
        return `${tierData.duration}min`;
      case 2:
        return "SuperChat";
      default:
        return `R$${tierData.amount}`;
    }
  };

  return (
    <div className="flex items-center gap-1.5 py-1.5 w-full">
      {TIERS.map((tierData, i) => (
        <Button
          key={tierData.tier}
          type="button"
          size="sm"
          onClick={() => onSelect(tierData.tier)}
          className={cn(
            "flex-1 h-6 px-2 text-[10px] font-semibold text-white border transition-all duration-300",
            tierData.color
          )}
        >
          {getDisplayText(tierData, displayIndex[i])}
        </Button>
      ))}
    </div>
  );
};