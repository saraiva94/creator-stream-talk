import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type LiveRow = {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "live" | "ended";
  scheduledFor?: string | null;
  price?: number | null;
  viewers: number;
};

type Props = {
  lives: LiveRow[];
};

const statusVariant: Record<LiveRow["status"], "secondary" | "outline" | "default" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  live: "default",
  ended: "destructive",
};

const LivesTable = ({ lives }: Props) => {
  if (lives.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">
        Nenhuma live encontrada (mock).
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Agendada</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Viewers</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lives.map((live) => (
            <TableRow key={live.id}>
              <TableCell className="font-medium">{live.title}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[live.status]} className="capitalize">
                  {live.status}
                </Badge>
              </TableCell>
              <TableCell>{live.scheduledFor ? new Date(live.scheduledFor).toLocaleString("pt-BR") : "—"}</TableCell>
              <TableCell>{live.price ? `R$ ${live.price.toFixed(2)}` : "Grátis"}</TableCell>
              <TableCell>{live.viewers}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline">
                  Editar
                </Button>
                <Button size="sm" variant="secondary">
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LivesTable;
