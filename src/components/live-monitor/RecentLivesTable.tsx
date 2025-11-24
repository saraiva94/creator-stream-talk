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
import { type RecentLive } from "@/lib/liveMonitorService";

type Props = {
  lives: RecentLive[];
  isLoading?: boolean;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const RecentLivesTable = ({ lives, isLoading }: Props) => {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Iniciada em</TableHead>
            <TableHead>Encerrada em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <TableRow key={`recent-skel-${idx}`}>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
              </TableRow>
            ))
          ) : lives.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                Nenhuma live encerrada recentemente
              </TableCell>
            </TableRow>
          ) : (
            lives.map((live) => (
              <TableRow key={live.id}>
                <TableCell className="font-medium">{live.title ?? "Sem título"}</TableCell>
                <TableCell>
                  <LiveStatusBadge status={live.status} />
                </TableCell>
                <TableCell>{formatDateTime(live.created_at)}</TableCell>
                <TableCell>{formatDateTime(live.ended_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default RecentLivesTable;
