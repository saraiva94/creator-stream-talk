import React from "react";

interface PreviewCountdownOverlayProps {
  remainingMs: number;
  totalMs: number;
}

const PreviewCountdownOverlay: React.FC<PreviewCountdownOverlayProps> = ({ remainingMs, totalMs }) => {
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const totalSeconds = Math.max(1, Math.ceil(totalMs / 1000));
  const progress = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-background/90 p-4 shadow-lg backdrop-blur">
        <p className="text-center text-sm text-muted-foreground">Preview mode</p>
        <p className="mt-1 text-center text-lg font-semibold">{secondsLeft}s remaining</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
            aria-label={`Preview remaining ${secondsLeft} seconds of ${totalSeconds}`}
          />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Enjoy a limited preview. Purchase to continue watching without interruptions.
        </p>
      </div>
    </div>
  );
};

export default PreviewCountdownOverlay;
