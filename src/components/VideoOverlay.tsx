interface VideoOverlayProps {
  title: string;
  description: string;
  primaryButtonText: string;
  onPrimaryClick: () => void;
  secondaryButtonText?: string;
  onSecondaryClick?: () => void;
}

export const VideoOverlay = ({
  title,
  description,
  primaryButtonText,
  onPrimaryClick,
  secondaryButtonText,
  onSecondaryClick,
}: VideoOverlayProps) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-md mx-4 p-8 rounded-lg bg-card border border-border text-center space-y-6">
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onPrimaryClick}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            {primaryButtonText}
          </button>
          {secondaryButtonText && onSecondaryClick && (
            <button
              onClick={onSecondaryClick}
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/90 transition-colors"
            >
              {secondaryButtonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
