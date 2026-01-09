import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, CreditCard, MessageSquare, UserPlus, ArrowDownCircle, Wallet, Clock } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface RevenueData {
  // Créditos consumidos em lives (vem de platform_revenue source_type='live_earnings')
  liveCreditsIncome: number;
  liveCreditsGross: number;
  // Superchats (vem de platform_revenue source_type='superchat')
  superchatIncome: number;
  superchatGross: number;
  // Compra de créditos (vem de platform_revenue source_type='credits_purchase')
  creditsPurchaseIncome: number;
  creditsPurchaseGross: number;
  // Registros (vem de platform_revenue source_type='registration' ou 'REGISTRATION')
  registrationIncome: number;
  registrationGross: number;
  // Saques
  withdrawals: number;
  // Totais
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
        // Busca dados da tabela platform_revenue (fonte principal de verdade)
        const { data: platformRevenue } = await supabase
          .from("platform_revenue")
          .select("amount, source_type");

        // Busca saques aprovados/pagos
        const { data: withdrawals } = await supabase
          .from("payout_requests")
          .select("amount, status")
          .in("status", ["approved", "paid"]);

        // Inicializa contadores (platform_revenue.amount está em centavos)
        let liveCreditsIncome = 0;
        let liveCreditsGross = 0;
        let superchatIncome = 0;
        let superchatGross = 0;
        let creditsPurchaseIncome = 0;
        let creditsPurchaseGross = 0;
        let registrationIncome = 0;
        let registrationGross = 0;

        platformRevenue?.forEach((entry) => {
          const amountCents = Number(entry.amount) || 0;
          const amountReais = amountCents / 100;
          const sourceType = (entry.source_type || "").toLowerCase();

          if (sourceType === "live_earnings") {
            // Créditos consumidos em lives: plataforma recebe 20%, criador 80%
            liveCreditsIncome += amountReais;
            liveCreditsGross += amountReais / 0.2; // Gross = platform / 0.2
          } else if (sourceType === "superchat") {
            // Superchats: plataforma recebe 20%, criador 80%
            superchatIncome += amountReais;
            superchatGross += amountReais / 0.2;
          } else if (sourceType === "credits_purchase") {
            // Compra de créditos: 100% vai para plataforma
            creditsPurchaseIncome += amountReais;
            creditsPurchaseGross += amountReais;
          } else if (sourceType === "registration") {
            // Registros: plataforma recebe o que sobra após comissões
            registrationIncome += amountReais;
            // Gross é R$5.00 por registro (500 centavos = R$5)
            registrationGross += 5;
          }
        });

        const totalWithdrawals = withdrawals?.reduce((sum, w) => sum + (Number(w.amount) / 100), 0) || 0;
        const totalIncome = liveCreditsIncome + superchatIncome + creditsPurchaseIncome + registrationIncome;
        const platformBalance = totalIncome - totalWithdrawals;

        setData({
          liveCreditsIncome,
          liveCreditsGross,
          superchatIncome,
          superchatGross,
          creditsPurchaseIncome,
          creditsPurchaseGross,
          registrationIncome,
          registrationGross,
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
      label: "Créditos em Lives",
      description: "Consumo de créditos durante transmissões",
      value: data.liveCreditsIncome,
      total: data.liveCreditsGross,
      icon: <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />,
      color: "text-purple-500",
      bgColor: "rgba(168, 85, 247, 0.1)",
      borderColor: "rgba(168, 85, 247, 0.3)",
    },
    {
      label: t.revenue.superchats,
      description: "Mensagens destacadas pagas",
      value: data.superchatIncome,
      total: data.superchatGross,
      icon: <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />,
      color: "text-yellow-500",
      bgColor: "rgba(234, 179, 8, 0.1)",
      borderColor: "rgba(234, 179, 8, 0.3)",
    },
    {
      label: t.revenue.credits,
      description: "Pacotes de créditos vendidos",
      value: data.creditsPurchaseIncome,
      total: data.creditsPurchaseGross,
      icon: <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />,
      color: "text-blue-500",
      bgColor: "rgba(59, 130, 246, 0.1)",
      borderColor: "rgba(59, 130, 246, 0.3)",
    },
    {
      label: t.revenue.registrations,
      description: "Assinaturas de novos usuários",
      value: data.registrationIncome,
      total: data.registrationGross,
      icon: <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />,
      color: "text-green-500",
      bgColor: "rgba(34, 197, 94, 0.1)",
      borderColor: "rgba(34, 197, 94, 0.3)",
    },
  ];

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          {t.revenue.title}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Dados da tabela platform_revenue (fonte única de verdade)
        </CardDescription>
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
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {incomeItems.map((item) => (
              <Card 
                key={item.label} 
                style={{ 
                  backgroundColor: item.bgColor,
                  borderColor: item.borderColor
                }}
              >
                <CardContent className="p-3 sm:pt-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {item.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium truncate">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className={`font-bold text-lg sm:text-2xl ${item.color}`}>
                      +{formatBRL(item.value)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.revenue.gross}: {formatBRL(item.total)}
                    </p>
                  </div>
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