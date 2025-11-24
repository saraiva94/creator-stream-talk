import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

type Point = { date: string; revenue: number };

type Props = {
  data: Point[];
  isLoading?: boolean;
};

const HistoryCharts = ({ data, isLoading }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita histórica</CardTitle>
        <CardDescription>Valores fictícios para validação</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ChartContainer
            config={{
              revenue: { label: "Receita", color: "hsl(var(--chart-4))" },
            }}
            className="h-56"
          >
            <LineChart data={data} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoryCharts;
