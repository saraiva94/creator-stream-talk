import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Video, Wifi, WifiOff, Play, Square } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export type StreamPhase = "idle" | "preparing" | "live";

interface TwoStepStreamControlProps {
  streamPhase: StreamPhase;
  onPrepare: () => void;
  onGoLive: () => void;
  onEndStream: () => void;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
}

export const TwoStepStreamControl = ({
  streamPhase,
  onPrepare,
  onGoLive,
  onEndStream,
  disabled,
  compact,
  fullWidth,
}: TwoStepStreamControlProps) => {
  const { t } = useLanguage();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [streamPhase]);

  // fullWidth mode - full width buttons for mobile footer
  if (fullWidth) {
    if (streamPhase === "idle") {
      return (
        <Button
          onClick={onPrepare}
          disabled={disabled}
          size="lg"
          className={cn("w-full gap-2", isAnimating && "scale-[1.01]")}
        >
          <Video className="h-4 w-4" />
          {t.liveManagement?.prepareStream || "Preparar Transmissão"}
        </Button>
      );
    }

    if (streamPhase === "preparing") {
      return (
        <div className="flex gap-2 w-full">
          <Button
            onClick={onGoLive}
            disabled={disabled}
            size="lg"
            className={cn("flex-1 gap-2 bg-green-600 hover:bg-green-700", isAnimating && "scale-[1.01]")}
          >
            <Play className="h-4 w-4" />
            {t.liveManagement?.goLive || "Ficar Online"}
          </Button>
          <Button
            onClick={onEndStream}
            disabled={disabled}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    // Live phase
    return (
      <Button
        onClick={onEndStream}
        disabled={disabled}
        size="lg"
        variant="destructive"
        className={cn("w-full gap-2", isAnimating && "scale-[1.01]")}
      >
        <Square className="h-4 w-4" />
        {t.liveManagement?.endStream || "Encerrar Transmissão"}
      </Button>
    );
  }

  if (compact) {
    // Compact mode for mobile
    if (streamPhase === "idle") {
      return (
        <Button
          onClick={onPrepare}
          disabled={disabled}
          size="sm"
          className={cn(
            "gap-2 transition-all duration-300",
            isAnimating && "scale-105"
          )}
        >
          <Video className="h-4 w-4" />
          {t.liveManagement?.prepareStream || "Preparar"}
        </Button>
      );
    }

    if (streamPhase === "preparing") {
      return (
        <div className="flex gap-2">
          <Button
            onClick={onGoLive}
            disabled={disabled}
            size="sm"
            className={cn(
              "gap-2 bg-green-600 hover:bg-green-700 transition-all duration-300",
              isAnimating && "scale-105 animate-pulse"
            )}
          >
            <Play className="h-4 w-4" />
            {t.liveManagement?.goLive || "Ficar Online"}
          </Button>
          <Button
            onClick={onEndStream}
            disabled={disabled}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    // Live phase
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
        {t.liveManagement?.endStream || "Encerrar"}
      </Button>
    );
  }

  // Full-size desktop control
  return (
    <div className="flex items-center gap-3">
      {/* Phase indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
        {streamPhase === "idle" && (
          <>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Offline</span>
          </>
        )}
        {streamPhase === "preparing" && (
          <>
            <Video className="h-4 w-4 text-yellow-500 animate-pulse" />
            <span className="text-sm text-yellow-500">
              {t.liveManagement?.preview || "Prévia"}
            </span>
          </>
        )}
        {streamPhase === "live" && (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Ao Vivo
            </span>
          </>
        )}
      </div>

      {/* Action buttons based on phase */}
      {streamPhase === "idle" && (
        <Button
          onClick={onPrepare}
          disabled={disabled}
          className={cn(
            "gap-2 transition-all duration-300",
            isAnimating && "scale-105"
          )}
        >
          <Video className="h-4 w-4" />
          {t.liveManagement?.prepareStream || "Preparar Transmissão"}
        </Button>
      )}

      {streamPhase === "preparing" && (
        <div className="flex gap-2">
          <Button
            onClick={onGoLive}
            disabled={disabled}
            className={cn(
              "gap-2 bg-green-600 hover:bg-green-700 text-white transition-all duration-300",
              isAnimating && "scale-105"
            )}
          >
            <Play className="h-4 w-4" />
            {t.liveManagement?.goLive || "Ficar Online"}
          </Button>
          <Button
            onClick={onEndStream}
            disabled={disabled}
            variant="outline"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      )}

      {streamPhase === "live" && (
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
          {t.liveManagement?.endStream || "Encerrar Transmissão"}
        </Button>
      )}
    </div>
  );
};
