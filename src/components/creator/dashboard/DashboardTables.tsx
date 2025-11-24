import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type TopLive = {
  id: string;
  title: string;
  viewers: number;
  revenue: number;
};

type Props = {
  lives: TopLive[];
};

const DashboardTables = ({ lives }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lives em destaque</CardTitle>
        <CardDescription>Dados mockados para validação visual</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Espectadores</TableHead>
              <TableHead>Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lives.map((live) => (
              <TableRow key={live.id}>
                <TableCell className="font-medium">{live.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{live.viewers} viewers</Badge>
                </TableCell>
                <TableCell>R$ {live.revenue.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default DashboardTables;
