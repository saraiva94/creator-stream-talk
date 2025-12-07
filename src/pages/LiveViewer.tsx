import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import ViewerAccessGate from "@/components/ViewerAccessGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2 } from "lucide-react";
import { api, LiveInfoResponse, LiveLifecycleStatus } from "@/lib/api";
import ShareLiveDialog from "@/components/ShareLiveDialog";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const statusLabel = (status: LiveLifecycleStatus | null | undefined) => {
  switch (status) {
    case "live":
      return { label: "Live", variant: "destructive" as const };
    case "waiting_for_host":
      return { label: "Waiting for host", variant: "secondary" as const };
    default:
      return { label: "Offline", variant: "outline" as const };
  }
};

const formatPrice = (price?: number | null, currency?: string | null) => {
  if (price == null) return "";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  });
  return formatter.format(price);
};

const LiveInfoHeader: React.FC<{ info: LiveInfoResponse | null; loading: boolean }> = ({
  info,
  loading,
}) => {
  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!info) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">Live not found</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">This live could not be located.</CardContent>
      </Card>
    );
  }

  const { label, variant } = statusLabel(info.status);
  const priceLabel = info.requiresPayment ? formatPrice(info.price, info.currency) : "Free";

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-2xl font-semibold">{info.title || "Live session"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {info.creatorName ? `Hosted by ${info.creatorName}` : "Creator live stream"}
          </p>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {info.description && <p>{info.description}</p>}
        {info.price != null && (
          <div className="flex items-center gap-2 text-primary">
            <span className="font-medium">Price:</span>
            <span>{priceLabel}</span>
          </div>
        )}
        {info.roomName && (
          <div className="text-xs uppercase text-muted-foreground">Room: {info.roomName}</div>
        )}
      </CardContent>
    </Card>
  );
};

const LiveViewer: React.FC = () => {
  const { liveId } = useParams<{ liveId: string }>();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const {
    data: liveInfo,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["live", liveId],
    queryFn: () => {
      if (!liveId) throw new Error("Missing liveId");
      return api.lives.getInfo(liveId);
    },
    enabled: Boolean(liveId),
  });

  const offline = liveInfo && liveInfo.status && !["live", "waiting_for_host"].includes(liveInfo.status);

  const liveUrl = typeof window !== 'undefined' ? `${window.location.origin}/live/${liveId}` : '';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {/* Share Button */}
        {liveId && liveInfo && (
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareDialogOpen(true)}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
          </div>
        )}

        <LiveInfoHeader info={liveInfo ?? null} loading={isLoading} />

        {isError && (
          <Card>
            <CardContent className="py-6 text-destructive">Failed to load live information.</CardContent>
          </Card>
        )}

        {offline && (
          <Card className="mb-6">
            <CardContent className="py-6">This live is not currently active.</CardContent>
          </Card>
        )}

        {liveId && !isError && (
          <ViewerAccessGate liveId={liveId} />
        )}
      </main>

      {/* Share Dialog */}
      {liveId && liveInfo && (
        <ShareLiveDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          liveUrl={liveUrl}
          liveId={liveId}
          creatorName={liveInfo.creatorName || "Creator"}
          user={user}
        />
      )}
    </div>
  );
};

export default LiveViewer;
