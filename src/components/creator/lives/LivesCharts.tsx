import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

type Point = { label: string; viewers: number };

type Props = {
  data: Point[];
  isLoading?: boolean;
};

const LivesCharts = ({ data, isLoading }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engajamento</CardTitle>
        <CardDescription>Viewers por live (mock)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ChartContainer
            config={{
              viewers: { label: "Viewers", color: "hsl(var(--chart-3))" },
            }}
            className="h-56"
          >
            <BarChart data={data} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="viewers" fill="var(--color-viewers)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default LivesCharts;
