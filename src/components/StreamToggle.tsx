import { cn } from "@/lib/utils";

interface StreamToggleProps {
  isStreaming: boolean;
  onToggle: (streaming: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const StreamToggle = ({ isStreaming, onToggle, disabled, compact }: StreamToggleProps) => {
  if (compact) {
    return (
      <button
        onClick={() => onToggle(!isStreaming)}
        disabled={disabled}
        className={cn(
          "px-4 py-2 rounded-full transition-all duration-300 flex items-center gap-2 text-sm font-medium",
          disabled && "opacity-50 cursor-not-allowed",
          isStreaming 
            ? "bg-green-500 text-white" 
            : "bg-destructive text-white"
        )}
      >
        <span className={cn(
          "w-2 h-2 rounded-full",
          isStreaming ? "bg-white animate-pulse" : "bg-white/60"
        )} />
        {isStreaming ? "Online" : "Desligado"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onToggle(!isStreaming)}
        disabled={disabled}
        className={cn(
          "relative w-48 h-10 rounded-full transition-all duration-300 flex items-center",
          disabled && "opacity-50 cursor-not-allowed",
          isStreaming 
            ? "bg-green-500/20 border-2 border-green-500" 
            : "bg-destructive/20 border-2 border-destructive"
        )}
      >
        {/* Sliding indicator */}
        <div
          className={cn(
            "absolute w-24 h-8 rounded-full transition-all duration-300 flex items-center justify-center text-sm font-medium",
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
            "absolute left-4 text-xs font-medium transition-opacity",
            isStreaming ? "opacity-50 text-muted-foreground" : "opacity-0"
          )}
        >
          Desligado
        </span>
        <span
          className={cn(
            "absolute right-4 text-xs font-medium transition-opacity",
            isStreaming ? "opacity-0" : "opacity-50 text-muted-foreground"
          )}
        >
          Online
        </span>
      </button>
    </div>
  );
};
