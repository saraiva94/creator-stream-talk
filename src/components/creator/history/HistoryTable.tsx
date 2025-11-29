import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Entry = {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  revenue: number;
  viewers: number;
};

type Props = {
  entries: Entry[];
};

const HistoryTable = ({ entries }: Props) => {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead>Viewers</TableHead>
            <TableHead>Receita</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.title}</TableCell>
              <TableCell>{new Date(entry.date).toLocaleString("pt-BR")}</TableCell>
              <TableCell>{entry.durationMinutes} min</TableCell>
              <TableCell>{entry.viewers}</TableCell>
              <TableCell>R$ {entry.revenue.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default HistoryTable;
