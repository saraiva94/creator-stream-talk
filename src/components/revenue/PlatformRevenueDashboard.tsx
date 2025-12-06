import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, CreditCard, MessageSquare, UserPlus, ArrowDownCircle, Wallet } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

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
  const { t } = useLanguage();
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
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>{t.revenue.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const incomeItems = [
    {
      label: t.revenue.credits,
      value: data.creditsIncome * 0.2,
      total: data.creditsIncome,
      icon: <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />,
      color: "text-blue-500",
    },
    {
      label: t.revenue.superchats,
      value: data.superchatIncome * 0.2,
      total: data.superchatIncome,
      icon: <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />,
      color: "text-yellow-500",
    },
    {
      label: t.revenue.registrations,
      value: (data.registrationIncome / 5) * 3.5,
      total: data.registrationIncome,
      icon: <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />,
      color: "text-green-500",
    },
  ];

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          {t.revenue.title}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{t.revenue.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{t.revenue.totalRevenue}</p>
                  <p className="text-lg sm:text-2xl font-bold text-primary">{formatBRL(data.totalIncome)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <ArrowDownCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{t.revenue.totalWithdrawals}</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-500">{formatBRL(data.withdrawals)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Income Breakdown */}
        <div>
          <h4 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">{t.revenue.entriesByType}</h4>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            {incomeItems.map((item) => (
              <Card key={item.label} className={`bg-${item.color.replace('text-', '')}/10 border-${item.color.replace('text-', '')}/30`} style={{ 
                backgroundColor: item.color === 'text-blue-500' ? 'rgba(59, 130, 246, 0.1)' : item.color === 'text-yellow-500' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                borderColor: item.color === 'text-blue-500' ? 'rgba(59, 130, 246, 0.3)' : item.color === 'text-yellow-500' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(34, 197, 94, 0.3)'
              }}>
                <CardContent className="p-3 sm:pt-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {item.icon}
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {t.revenue.gross}: {formatBRL(item.total)}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold text-lg sm:text-2xl mt-2 ${item.color}`}>+{formatBRL(item.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Platform Balance */}
        <div className="pt-3 sm:pt-4 border-t border-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm sm:text-lg font-semibold">{t.revenue.netBalance}</span>
            <span className={`text-xl sm:text-2xl font-bold ${data.platformBalance >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatBRL(data.platformBalance)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlatformRevenueDashboard;