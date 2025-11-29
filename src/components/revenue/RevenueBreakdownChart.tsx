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
import { type RevenueSeriesPoint } from "@/lib/platformRevenueService";

type Props = {
  data: RevenueSeriesPoint[];
  isLoading?: boolean;
};

const RevenueBreakdownChart = ({ data, isLoading }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita por dia</CardTitle>
        <CardDescription>Valores somados por data em platform_revenue</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        ) : (
          <ChartContainer
            config={{
              platform: {
                label: "Plataforma",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-64"
          >
            <AreaChart data={data} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} width={80} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `R$ ${(value as number).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  />
                }
              />
              <Area
                dataKey="platform"
                type="monotone"
                stroke="var(--color-platform)"
                fill="var(--color-platform)"
                fillOpacity={0.2}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default RevenueBreakdownChart;
