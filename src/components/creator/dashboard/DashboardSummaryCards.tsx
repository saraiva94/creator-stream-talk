import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Users, Wallet, Calendar } from "lucide-react";

type Props = {
  summary: {
    activeLives: number;
    totalRevenue: number;
    followers: number;
    upcomingLives: number;
  } | null;
  isLoading?: boolean;
};

const DashboardSummaryCards = ({ summary, isLoading }: Props) => {
  const items = [
    { label: "Lives ativas", value: summary?.activeLives ?? 0, icon: <Activity className="h-5 w-5 text-primary" /> },
    { label: "Receita total", value: `R$ ${(summary?.totalRevenue ?? 0).toFixed(2)}`, icon: <Wallet className="h-5 w-5 text-primary" /> },
    { label: "Seguidores", value: summary?.followers ?? 0, icon: <Users className="h-5 w-5 text-primary" /> },
    { label: "Próximas lives", value: summary?.upcomingLives ?? 0, icon: <Calendar className="h-5 w-5 text-primary" /> },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            {item.icon}
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-6 w-24" /> : <div className="text-2xl font-bold">{item.value}</div>}
            <CardDescription className="text-muted-foreground text-xs mt-1">Dados simulados</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardSummaryCards;
