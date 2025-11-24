import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeDollarSign, Banknote, TrendingUp } from "lucide-react";

type Props = {
  grossRevenue: number;
  platformCut: number;
  creatorPayouts: number;
  isLoading?: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);

const RevenueSummaryCards = ({ grossRevenue, platformCut, creatorPayouts, isLoading }: Props) => {
  const items = [
    {
      title: "Receita total",
      description: "Pagamentos brutos processados",
      value: formatCurrency(grossRevenue),
      icon: <TrendingUp className="h-5 w-5 text-primary" />,
    },
    {
      title: "Parcela da plataforma",
      description: "Corte da plataforma (platform_revenue)",
      value: formatCurrency(platformCut),
      icon: <BadgeDollarSign className="h-5 w-5 text-primary" />,
    },
    {
      title: "Pagamentos a criadores",
      description: "Saques aprovados/pagos",
      value: formatCurrency(creatorPayouts),
      icon: <Banknote className="h-5 w-5 text-primary" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.title} className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            {item.icon}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold">{item.value}</div>
            )}
            <CardDescription className="mt-1 text-muted-foreground">{item.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RevenueSummaryCards;
