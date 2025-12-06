import React from "react";
import { Clock, CreditCard } from "lucide-react";

interface PreviewCountdownOverlayProps {
  remainingMs: number;
  totalMs: number;
}

const PreviewCountdownOverlay: React.FC<PreviewCountdownOverlayProps> = ({ remainingMs, totalMs }) => {
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const totalSeconds = Math.max(1, Math.ceil(totalMs / 1000));
  const progress = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
  
  // Calculate blur intensity - starts at 0, increases as time decreases
  const blurIntensity = Math.max(0, Math.min(20, ((totalMs - remainingMs) / totalMs) * 20));

  return (
    <>
      {/* Progressive blur overlay on video */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{ 
          backdropFilter: `blur(${blurIntensity}px)`,
          WebkitBackdropFilter: `blur(${blurIntensity}px)`,
        }}
      />
      
      {/* Countdown overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-xl bg-background/90 p-6 shadow-2xl backdrop-blur-sm border border-primary/20">
          <div className="flex items-center justify-center gap-2 text-primary mb-2">
            <Clock className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium uppercase tracking-wider">
              Prévia
            </span>
          </div>
          
          <p className="text-center text-4xl font-bold text-foreground mb-3">
            {secondsLeft}s
          </p>
          
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted mb-4">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
              style={{ width: `${progress}%` }}
              aria-label={`Preview remaining ${secondsLeft} seconds of ${totalSeconds}`}
            />
          </div>
          
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <p className="text-center text-sm">
              Compre créditos para continuar assistindo
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PreviewCountdownOverlay;
