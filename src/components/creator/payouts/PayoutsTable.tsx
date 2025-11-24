import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Payout = {
  id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  requestedAt: string;
};

type Props = {
  payouts: Payout[];
};

const statusVariant: Record<Payout["status"], "outline" | "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  paid: "default",
  rejected: "destructive",
};

const PayoutsTable = ({ payouts }: Props) => {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Solicitado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payouts.map((payout) => (
            <TableRow key={payout.id}>
              <TableCell className="text-xs text-muted-foreground">{payout.id}</TableCell>
              <TableCell className="font-medium">R$ {payout.amount.toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[payout.status]} className="capitalize">
                  {payout.status}
                </Badge>
              </TableCell>
              <TableCell>{new Date(payout.requestedAt).toLocaleString("pt-BR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PayoutsTable;
