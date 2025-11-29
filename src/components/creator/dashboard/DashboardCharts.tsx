import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Point = {
  date: string;
  revenue: number;
  views: number;
};

type Props = {
  data: Point[];
  isLoading?: boolean;
};

const DashboardCharts = ({ data, isLoading }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visão geral</CardTitle>
        <CardDescription>Receita e visualizações (mock)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ChartContainer
            config={{
              revenue: { label: "Receita", color: "hsl(var(--chart-1))" },
              views: { label: "Views", color: "hsl(var(--chart-2))" },
            }}
            className="h-64"
          >
            <AreaChart data={data} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} width={70} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) =>
                      name === "revenue"
                        ? `R$ ${(value as number).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : `${value} views`
                    }
                  />
                }
              />
              <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.25} />
              <Area dataKey="views" type="monotone" stroke="var(--color-views)" fill="var(--color-views)" fillOpacity={0.15} />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCharts;
