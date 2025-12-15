import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Play, Square } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface SingleStepStreamControlProps {
  isLive: boolean;
  onGoLive: () => void;
  onEndStream: () => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Simplified single-step stream control for LiveKit.
 * No "prepare" phase needed - just Go Live / End Stream.
 */
export const SingleStepStreamControl = ({
  isLive,
  onGoLive,
  onEndStream,
  disabled,
  compact,
}: SingleStepStreamControlProps) => {
  const { t } = useLanguage();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [isLive]);

  if (compact) {
    // Compact mode for mobile
    if (!isLive) {
      return (
        <Button
          onClick={onGoLive}
          disabled={disabled}
          size="sm"
          className={cn(
            "gap-2 bg-green-600 hover:bg-green-700 text-white transition-all duration-300",
            isAnimating && "scale-105"
          )}
        >
          <Play className="h-4 w-4" />
          {(t.liveManagement as any)?.goLive || "Ficar Online"}
        </Button>
      );
    }

    return (
      <Button
        onClick={onEndStream}
        disabled={disabled}
        size="sm"
        variant="destructive"
        className={cn(
          "gap-2 transition-all duration-300",
          isAnimating && "scale-105"
        )}
      >
        <Square className="h-4 w-4" />
        {(t.liveManagement as any)?.endStream || "Encerrar"}
      </Button>
    );
  }

  // Full-size desktop control
  return (
    <div className="flex items-center gap-3">
      {/* Phase indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
        {!isLive ? (
          <>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Offline</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Ao Vivo
            </span>
          </>
        )}
      </div>

      {/* Action button */}
      {!isLive ? (
        <Button
          onClick={onGoLive}
          disabled={disabled}
          className={cn(
            "gap-2 bg-green-600 hover:bg-green-700 text-white transition-all duration-300",
            isAnimating && "scale-105"
          )}
        >
          <Play className="h-4 w-4" />
          {(t.liveManagement as any)?.goLive || "Ficar Online"}
        </Button>
      ) : (
        <Button
          onClick={onEndStream}
          disabled={disabled}
          variant="destructive"
          className={cn(
            "gap-2 transition-all duration-300",
            isAnimating && "scale-105"
          )}
        >
          <Square className="h-4 w-4" />
          {(t.liveManagement as any)?.endStream || "Encerrar Transmissão"}
        </Button>
      )}
    </div>
  );
};
