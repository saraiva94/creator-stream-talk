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
  docked?: boolean;
  fullWidth?: boolean;
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
  docked,
  fullWidth,
}: SingleStepStreamControlProps) => {
  const { t } = useLanguage();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [isLive]);

  const goLiveLabel = (t.liveManagement as any)?.goLive || "Ficar Online";
  const endLabel = (t.liveManagement as any)?.endStream || "Encerrar Transmissão";

  // Docked or fullWidth mode - full width buttons
  if (docked || fullWidth) {
    return !isLive ? (
      <Button
        onClick={onGoLive}
        disabled={disabled}
        size="lg"
        className={cn("w-full gap-2", isAnimating && "scale-[1.01]")}
      >
        <Play className="h-4 w-4" />
        {goLiveLabel}
      </Button>
    ) : (
      <Button
        onClick={onEndStream}
        disabled={disabled}
        size="lg"
        variant="destructive"
        className={cn("w-full gap-2", isAnimating && "scale-[1.01]")}
      >
        <Square className="h-4 w-4" />
        {endLabel}
      </Button>
    );
  }

  if (compact) {
    // Compact mode for small surfaces
    if (!isLive) {
      return (
        <Button
          onClick={onGoLive}
          disabled={disabled}
          size="sm"
          className={cn("gap-2 transition-all duration-300", isAnimating && "scale-105")}
        >
          <Play className="h-4 w-4" />
          {goLiveLabel}
        </Button>
      );
    }

    return (
      <Button
        onClick={onEndStream}
        disabled={disabled}
        size="sm"
        variant="destructive"
        className={cn("gap-2 transition-all duration-300", isAnimating && "scale-105")}
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
            <Wifi className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
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
          className={cn("gap-2 transition-all duration-300", isAnimating && "scale-105")}
        >
          <Play className="h-4 w-4" />
          {goLiveLabel}
        </Button>
      ) : (
        <Button
          onClick={onEndStream}
          disabled={disabled}
          variant="destructive"
          className={cn("gap-2 transition-all duration-300", isAnimating && "scale-105")}
        >
          <Square className="h-4 w-4" />
          {endLabel}
        </Button>
      )}
    </div>
  );
};
