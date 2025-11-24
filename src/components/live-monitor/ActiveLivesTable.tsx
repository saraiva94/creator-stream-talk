import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import LiveStatusBadge from "./LiveStatusBadge";
import { type ActiveLive } from "@/lib/liveMonitorService";
import { Badge } from "@/components/ui/badge";

type Props = {
  lives: ActiveLive[];
  isLoading?: boolean;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const ActiveLivesTable = ({ lives, isLoading }: Props) => {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Creator ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último heartbeat</TableHead>
            <TableHead>Camera</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <TableRow key={`active-skel-${idx}`}>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
              </TableRow>
            ))
          ) : lives.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                Nenhuma live ativa no momento
              </TableCell>
            </TableRow>
          ) : (
            lives.map((live) => (
              <TableRow key={live.id}>
                <TableCell className="font-medium">{live.title ?? "Sem título"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{live.creator_id}</TableCell>
                <TableCell>
                  <LiveStatusBadge status={live.status} />
                </TableCell>
                <TableCell>{formatDateTime(live.last_heartbeat)}</TableCell>
                <TableCell>
                  <Badge variant={live.camera_active ? "default" : "secondary"}>
                    {live.camera_active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ActiveLivesTable;
