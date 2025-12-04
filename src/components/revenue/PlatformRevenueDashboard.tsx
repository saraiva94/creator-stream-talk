import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, CreditCard, MessageSquare, UserPlus, ArrowDownCircle, Wallet } from "lucide-react";

interface RevenueData {
  creditsIncome: number;
  superchatIncome: number;
  registrationIncome: number;
  withdrawals: number;
  totalIncome: number;
  platformBalance: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const PlatformRevenueDashboard = () => {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRevenue = async () => {
      try {
        // Fetch all transactions
        const { data: transactions } = await supabase
          .from("transactions")
          .select("type, amount, status")
          .eq("status", "completed");

        // Fetch all withdrawals
        const { data: withdrawals } = await supabase
          .from("payout_requests")
          .select("amount, status")
          .in("status", ["approved", "paid"]);

        let creditsIncome = 0;
        let superchatIncome = 0;
        let registrationIncome = 0;

        transactions?.forEach((tx) => {
          const amount = Number(tx.amount) || 0;
          if (tx.type === "credits_purchase") {
            creditsIncome += amount;
          } else if (tx.type === "superchat") {
            superchatIncome += amount;
          } else if (tx.type === "registration") {
            registrationIncome += amount;
          }
        });

        // Platform cut: 20% of credits and superchat, variable from registration (after commissions)
        const platformCredits = creditsIncome * 0.2;
        const platformSuperchat = superchatIncome * 0.2;
        // Registration: R$5.00 - R$1.00 (direct) - R$0.50 (root) = R$3.50 max to platform
        const platformRegistration = (registrationIncome / 5) * 3.5;

        const totalWithdrawals = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

        const totalIncome = platformCredits + platformSuperchat + platformRegistration;
        const platformBalance = totalIncome - totalWithdrawals;

        setData({
          creditsIncome,
          superchatIncome,
          registrationIncome,
          withdrawals: totalWithdrawals,
          totalIncome,
          platformBalance,
        });
      } catch (error) {
        console.error("[revenue] Load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRevenue();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Receita da Plataforma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const incomeItems = [
    {
      label: "Créditos",
      value: data.creditsIncome * 0.2,
      total: data.creditsIncome,
      icon: <CreditCard className="h-5 w-5 text-blue-500" />,
      color: "text-blue-500",
    },
    {
      label: "SuperChats",
      value: data.superchatIncome * 0.2,
      total: data.superchatIncome,
      icon: <MessageSquare className="h-5 w-5 text-yellow-500" />,
      color: "text-yellow-500",
    },
    {
      label: "Cadastros",
      value: (data.registrationIncome / 5) * 3.5,
      total: data.registrationIncome,
      icon: <UserPlus className="h-5 w-5 text-green-500" />,
      color: "text-green-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Dashboard de Receita
        </CardTitle>
        <CardDescription>Visão geral das finanças da plataforma</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total da Plataforma</p>
                  <p className="text-2xl font-bold text-primary">{formatBRL(data.totalIncome)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <ArrowDownCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total de Saques</p>
                  <p className="text-2xl font-bold text-green-500">{formatBRL(data.withdrawals)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Income Breakdown */}
        <div>
          <h4 className="font-semibold mb-3">Entradas por Tipo</h4>
          <div className="space-y-3">
            {incomeItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  {item.icon}
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Bruto: {formatBRL(item.total)}
                    </p>
                  </div>
                </div>
                <p className={`font-bold ${item.color}`}>+{formatBRL(item.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Balance */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Saldo Líquido da Plataforma</span>
            <span className={`text-2xl font-bold ${data.platformBalance >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatBRL(data.platformBalance)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlatformRevenueDashboard;
