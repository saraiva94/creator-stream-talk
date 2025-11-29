import { Badge } from "@/components/ui/badge";
import { type LiveLifecycleStatus } from "@/lib/liveMonitorService";

type Props = {
  status: LiveLifecycleStatus | null | undefined;
};

const statusVariant: Record<LiveLifecycleStatus, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "secondary",
  waiting_for_host: "secondary",
  live: "default",
  inactive: "outline",
  ending: "outline",
  ended: "destructive",
};

const LiveStatusBadge = ({ status }: Props) => {
  if (!status) {
    return <Badge variant="outline">unknown</Badge>;
  }

  return (
    <Badge variant={statusVariant[status] ?? "outline"} className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
};

export default LiveStatusBadge;
