import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import ViewerAccessGate from "@/components/ViewerAccessGate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, LiveInfoResponse, LiveLifecycleStatus } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

const getStatusLabel = (status: LiveLifecycleStatus | null | undefined, t: ReturnType<typeof useLanguage>["t"]) => {
  switch (status) {
    case "live":
      return { label: t.liveViewer?.live || "Live", variant: "destructive" as const };
    case "waiting_for_host":
      return { label: t.liveViewer?.waitingForHost || "Waiting for host", variant: "secondary" as const };
    default:
      return { label: t.liveViewer?.offline || "Offline", variant: "outline" as const };
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

const LiveInfoHeader: React.FC<{ info: LiveInfoResponse | null; loading: boolean; t: ReturnType<typeof useLanguage>["t"] }> = ({
  info,
  loading,
  t,
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
          <CardTitle className="text-xl">{t.liveViewer?.notFound || "Live not found"}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">{t.liveViewer?.notFoundDesc || "This live could not be located."}</CardContent>
      </Card>
    );
  }

  const { label, variant } = getStatusLabel(info.status, t);
  const priceLabel = info.requiresPayment ? formatPrice(info.price, info.currency) : (t.liveViewer?.free || "Free");

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-2xl font-semibold">{info.title || (t.liveViewer?.liveSession || "Live session")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {info.creatorName ? `${t.liveViewer?.hostedBy || "Hosted by"} ${info.creatorName}` : (t.liveViewer?.creatorStream || "Creator live stream")}
          </p>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {info.description && <p>{info.description}</p>}
        {info.price != null && (
          <div className="flex items-center gap-2 text-primary">
            <span className="font-medium">{t.liveViewer?.price || "Price"}:</span>
            <span>{priceLabel}</span>
          </div>
        )}
        {info.roomName && (
          <div className="text-xs uppercase text-muted-foreground">{t.liveViewer?.room || "Room"}: {info.roomName}</div>
        )}
      </CardContent>
    </Card>
  );
};

const LiveViewer: React.FC = () => {
  const { liveId } = useParams<{ liveId: string }>();
  const { t } = useLanguage();

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <LiveInfoHeader info={liveInfo ?? null} loading={isLoading} t={t} />

        {isError && (
          <Card>
            <CardContent className="py-6 text-destructive">{t.liveViewer?.loadError || "Failed to load live information."}</CardContent>
          </Card>
        )}

        {offline && (
          <Card className="mb-6">
            <CardContent className="py-6">{t.liveViewer?.notActive || "This live is not currently active."}</CardContent>
          </Card>
        )}

        {liveId && !isError && (
          <ViewerAccessGate liveId={liveId} />
        )}
      </main>
    </div>
  );
};

export default LiveViewer;
