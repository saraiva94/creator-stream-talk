import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  summary: {
    balance: number;
    pending: number;
    paid: number;
  };
  isLoading?: boolean;
};

const PayoutsSummary = ({ summary, isLoading }: Props) => {
  const items = [
    { label: "Saldo disponivel", value: `R$ ${summary.balance.toFixed(2)}` },
    { label: "Pendentes", value: `R$ ${summary.pending.toFixed(2)}` },
    { label: "Pagos", value: `R$ ${summary.paid.toFixed(2)}` },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-6 w-20" /> : <div className="text-xl font-bold">{item.value}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PayoutsSummary;
