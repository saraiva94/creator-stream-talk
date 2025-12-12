import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface StreamToggleProps {
  isStreaming: boolean;
  onToggle: (streaming: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const StreamToggle = ({ isStreaming, onToggle, disabled, compact }: StreamToggleProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [isStreaming]);

  if (compact) {
    return (
      <button
        onClick={() => onToggle(!isStreaming)}
        disabled={disabled}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          "transition-all duration-500 ease-in-out transform",
          isAnimating && "scale-105",
          disabled && "opacity-50 cursor-not-allowed",
          isStreaming 
            ? "bg-green-500 shadow-lg shadow-green-500/40" 
            : "bg-destructive shadow-lg shadow-destructive/40"
        )}
      >
        <span className="text-white text-xs font-bold uppercase">
          {isStreaming ? "ON" : "OFF"}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onToggle(!isStreaming)}
        disabled={disabled}
        className={cn(
          "relative w-48 h-10 rounded-full flex items-center",
          "transition-all duration-500 ease-in-out",
          isAnimating && "scale-[1.02]",
          disabled && "opacity-50 cursor-not-allowed",
          isStreaming 
            ? "bg-green-500/20 border-2 border-green-500 shadow-lg shadow-green-500/20" 
            : "bg-destructive/20 border-2 border-destructive shadow-lg shadow-destructive/20"
        )}
      >
        {/* Sliding indicator */}
        <div
          className={cn(
            "absolute w-24 h-8 rounded-full flex items-center justify-center text-sm font-medium",
            "transition-all duration-500 ease-in-out",
            isStreaming
              ? "left-[calc(100%-98px)] bg-green-500 text-white"
              : "left-1 bg-destructive text-white"
          )}
        >
          {isStreaming ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Online
            </span>
          ) : (
            "Desligado"
          )}
        </div>

        {/* Background labels */}
        <span
          className={cn(
            "absolute left-4 text-xs font-medium",
            "transition-opacity duration-500",
            isStreaming ? "opacity-50 text-muted-foreground" : "opacity-0"
          )}
        >
          Desligado
        </span>
        <span
          className={cn(
            "absolute right-4 text-xs font-medium",
            "transition-opacity duration-500",
            isStreaming ? "opacity-0" : "opacity-50 text-muted-foreground"
          )}
        >
          Online
        </span>
      </button>
    </div>
  );
};
