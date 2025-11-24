import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { type LiveAlert } from "@/lib/liveMonitorService";

type Props = {
  alerts: LiveAlert[];
  isLoading?: boolean;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const normalizeReason = (reason?: string | null) => {
  if (!reason) return "unknown";
  return reason.replace(/_/g, " ");
};

const LiveAlertsPanel = ({ alerts, isLoading }: Props) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Alertas</CardTitle>
          <CardDescription>Eventos recentes do monitor de lives</CardDescription>
        </div>
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {alerts.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={`alert-skel-${idx}`} className="space-y-2 rounded-lg border border-border/60 p-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum alerta recente.
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={`${alert.live_id}-${alert.ended_at ?? ""}`} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Live {alert.live_id}</div>
                <Badge variant="outline" className="capitalize">
                  {normalizeReason(alert.reason)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Encerrada em {formatDateTime(alert.ended_at)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Creator: {alert.creator_id}</div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default LiveAlertsPanel;
