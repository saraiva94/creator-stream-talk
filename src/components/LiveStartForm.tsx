import { useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Video } from "lucide-react";
import { api, LiveSummary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JitsiPlayer } from "@/components/JitsiPlayer";

interface LiveStartFormProps {
  onLiveUpdated?: (live: LiveSummary | null) => void;
  showEmbeddedPlayer?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  waiting_for_host: "Waiting for host",
  live: "Live",
  inactive: "Inactive",
  ending: "Ending",
  ended: "Ended",
};

const selectCurrentLive = (lives: LiveSummary[]): LiveSummary | null => {
  if (!lives?.length) {
    return null;
  }

  const liveOrWaiting = lives.find((live) =>
    ["live", "waiting_for_host"].includes(live.status ?? "")
  );

  if (liveOrWaiting) {
    return liveOrWaiting;
  }

  const upcoming = lives.find((live) => !["ended"].includes(live.status ?? ""));
  return upcoming ?? lives[0];
};

const selectStartCandidate = (lives: LiveSummary[]): LiveSummary | null => {
  if (!lives?.length) {
    return null;
  }

  return (
    lives.find((live) => !["live", "waiting_for_host", "ended"].includes(live.status ?? "")) ??
    null
  );
};

export const LiveStartForm: React.FC<LiveStartFormProps> = ({
  onLiveUpdated,
  showEmbeddedPlayer = true,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const livesQuery = useQuery({
    queryKey: ["creator", "lives"],
    queryFn: async () => {
      const response = await api.lives.listCreatorLives();
      return response.lives ?? [];
    },
  });

  const currentLive = useMemo(
    () => selectCurrentLive(livesQuery.data ?? []),
    [livesQuery.data]
  );

  const startCandidate = useMemo(
    () => selectStartCandidate(livesQuery.data ?? []),
    [livesQuery.data]
  );

  useEffect(() => {
    onLiveUpdated?.(currentLive ?? null);
  }, [currentLive, onLiveUpdated]);

  const handleRefetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["creator", "lives"] });
    await livesQuery.refetch();
  }, [livesQuery, queryClient]);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!startCandidate) {
        throw new Error("No scheduled live available to start");
      }
      console.debug("[creator] starting live", { liveId: startCandidate.id });
      return api.lives.start({ liveId: startCandidate.id });
    },
    onSuccess: async () => {
      console.debug("[creator] live started successfully");
      toast({
        title: "Live started",
        description: "Your Jitsi room is ready",
      });
      await handleRefetch();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unable to start the live";
      console.debug("[creator] live start failed", { error: message });
      toast({ title: "Start failed", description: message, variant: "destructive" });
    },
  });

  const statusLabel = currentLive?.status
    ? STATUS_LABELS[currentLive.status] ?? currentLive.status
    : "No live scheduled";

  const canStart = Boolean(startCandidate && startCandidate.id);
  const showPlayer =
    showEmbeddedPlayer &&
    currentLive?.room_name &&
    ["waiting_for_host", "live"].includes(currentLive.status ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" /> Live Controls
        </CardTitle>
        <CardDescription>
          Manage your current live status and mint a fresh Jitsi room when you are ready to go live.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {livesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading live data...
          </div>
        ) : livesQuery.isError ? (
          <p className="text-sm text-destructive">
            Failed to load lives. Please try again in a few moments.
          </p>
        ) : !currentLive ? (
          <p className="text-sm text-muted-foreground">
            You do not have any scheduled lives yet. Create one from the lives catalog to get started.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <Badge variant="outline">{statusLabel}</Badge>
            </div>
            {currentLive.title && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Title</p>
                <p className="text-base font-semibold">{currentLive.title}</p>
              </div>
            )}
            {currentLive.room_name && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Room name</p>
                <p className="font-mono text-sm">{currentLive.room_name}</p>
              </div>
            )}
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Creator %</p>
                <p>{currentLive.creator_percent ?? "-"}%</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Platform %</p>
                <p>{currentLive.platform_percent ?? "-"}%</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => startMutation.mutate()}
            disabled={!canStart || startMutation.isPending}
          >
            {startMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {canStart ? "Start Live" : "No live available"}
          </Button>
          <Button
            variant="outline"
            onClick={() => livesQuery.refetch()}
            disabled={livesQuery.isFetching}
          >
            {livesQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh
          </Button>
        </div>

        {showPlayer && currentLive?.room_name && (
          <div className="rounded-lg border p-2">
            <JitsiPlayer roomName={currentLive.room_name} height="360px" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveStartForm;
