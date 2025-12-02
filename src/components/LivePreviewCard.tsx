import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LiveLifecycleStatus, LiveSummary } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface LivePreviewCardProps {
  live: LiveSummary;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
}

const statusLabel = (status: LiveLifecycleStatus | null | undefined) => {
  switch (status) {
    case "live":
      return "Live";
    case "waiting_for_host":
      return "Waiting";
    case "scheduled":
      return "Scheduled";
    case "inactive":
      return "Inactive";
    case "ending":
      return "Ending";
    case "ended":
      return "Ended";
    default:
      return "Unknown";
  }
};

const badgeClass = (status: LiveLifecycleStatus | null | undefined) => {
  switch (status) {
    case "live":
      return "bg-destructive text-white";
    case "waiting_for_host":
    case "scheduled":
      return "bg-amber-500 text-white";
    case "ended":
      return "bg-muted text-foreground";
    default:
      return "bg-secondary text-foreground";
  }
};

const LivePreviewCard = ({ live, isLoggedIn, onLoginRequired }: LivePreviewCardProps) => {
  const navigate = useNavigate();

  const handleEnter = () => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }

    navigate(`/live/${live.id}`);
  };

  const priceDisplay = live.price ? `${live.price.toFixed(2)}` : "Free";

  return (
    <Card className="h-full flex flex-col border-border bg-card shadow-sm">
      <div className="relative aspect-video bg-gradient-to-br from-primary/15 via-background to-secondary" />

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Badge className={badgeClass(live.status)}>{statusLabel(live.status)}</Badge>
          <span className="text-sm text-muted-foreground">{priceDisplay}</span>
        </div>

        <div className="space-y-2 flex-1">
          <h3 className="font-semibold text-foreground line-clamp-1">
            {live.title || "Live session"}
          </h3>
          {live.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{live.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Creator: {live.creator_username || live.creator_id}
          </p>
        </div>

        <Button onClick={handleEnter} className="w-full" disabled={live.status === "ended"}>
          {live.status === "ended" ? "Ended" : "Watch live"}
        </Button>
      </div>
    </Card>
  );
};

export default LivePreviewCard;
