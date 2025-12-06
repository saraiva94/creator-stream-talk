import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Video, TrendingUp, UserCheck, Wallet, CreditCard, MessageSquare, UserPlus, ArrowDownCircle, Shield, Banknote } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import type { User } from "@supabase/supabase-js";

type AdminStats = {
  totalUsers: number;
  totalCreators: number;
  onlineCreators: number;
  totalRevenue: number;
};

type RevenueBreakdown = {
  creditsIncome: number;
  superchatIncome: number;
  registrationIncome: number;
  platformCredits: number;
  platformSuperchat: number;
  platformRegistration: number;
  totalWithdrawals: number;
  platformBalance: number;
};

type PayoutRequest = {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles?: { username?: string | null; email?: string | null } | null;
  creator_bank_accounts?: { bank_name?: string | null; account_number?: string | null; account_holder_name?: string | null } | null;
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalCreators: 0,
    onlineCreators: 0,
    totalRevenue: 0,
  });
  const [revenue, setRevenue] = useState<RevenueBreakdown>({
    creditsIncome: 0,
    superchatIncome: 0,
    registrationIncome: 0,
    platformCredits: 0,
    platformSuperchat: 0,
    platformRegistration: 0,
    totalWithdrawals: 0,
    platformBalance: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      const rolesFromMeta = (() => {
        const metaRolesRaw = session.user.app_metadata?.roles ?? session.user.user_metadata?.roles;
        const metaRoles = Array.isArray(metaRolesRaw)
          ? metaRolesRaw.map((r) => String(r).toLowerCase())
          : typeof metaRolesRaw === "string"
            ? [metaRolesRaw.toLowerCase()]
            : [];
        const primaryRoleRaw =
          (session.user.app_metadata?.app_role as string | undefined) ??
          (session.user.user_metadata?.app_role as string | undefined) ??
          (session.user.app_metadata?.role as string | undefined) ??
          (session.user.user_metadata?.role as string | undefined);

        const normalized = new Set<string>();
        metaRoles.forEach((r) => normalized.add(r));
        if (primaryRoleRaw) {
          normalized.add(primaryRoleRaw.toLowerCase());
        }
        return normalized;
      })();

      let hasAdminRole = rolesFromMeta.has("admin");

      if (!hasAdminRole) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);

        hasAdminRole = roles?.some((r) => r.role === "admin") || false;
      }

      if (!hasAdminRole) {
        toast({
          title: t.admin.accessDenied,
          description: t.admin.noPermission,
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await Promise.all([
        fetchStats(),
        fetchRevenueBreakdown(),
        fetchPayoutRequests(),
      ]);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [usersRes, creatorsRes, onlineRes, revenueRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("creator_profiles").select("id", { count: "exact", head: true }),
        supabase.from("creator_profiles").select("id", { count: "exact", head: true }).eq("is_streaming", true),
        supabase.from("transactions").select("platform_amount").eq("status", "completed"),
      ]);

      type TransactionRow = { platform_amount: number | null };
      const revenueData = (revenueRes.data ?? []) as TransactionRow[];
      const totalRevenue = revenueData.reduce((sum, tx) => sum + (tx.platform_amount || 0), 0);

      setStats({
        totalUsers: usersRes.count || 0,
        totalCreators: creatorsRes.count || 0,
        onlineCreators: onlineRes.count || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchRevenueBreakdown = async () => {
    try {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("type, amount, status")
        .eq("status", "completed");

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

      const platformCredits = creditsIncome * 0.2;
      const platformSuperchat = superchatIncome * 0.2;
      const platformRegistration = (registrationIncome / 5) * 3.5;

      const totalWithdrawals = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;
      const totalIncome = platformCredits + platformSuperchat + platformRegistration;
      const platformBalance = totalIncome - totalWithdrawals;

      setRevenue({
        creditsIncome,
        superchatIncome,
        registrationIncome,
        platformCredits,
        platformSuperchat,
        platformRegistration,
        totalWithdrawals,
        platformBalance,
      });
    } catch (error) {
      console.error("Error fetching revenue breakdown:", error);
    }
  };

  const fetchPayoutRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("payout_requests")
        .select(`
          id,
          creator_id,
          amount,
          status,
          created_at,
          approved_at,
          approved_by,
          admin_notes,
          bank_account_id,
          paid_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const mappedData: PayoutRequest[] = (data || []).map((row) => ({
        id: row.id,
        creator_id: row.creator_id,
        amount: row.amount,
        status: row.status,
        created_at: row.created_at,
        profiles: null,
        creator_bank_accounts: null,
      }));
      
      setPayoutRequests(mappedData);
    } catch (error) {
      console.error("Error fetching payout requests:", error);
    }
  };

  const handlePayoutAction = async (requestId: string, action: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("payout_requests")
        .update({
          status: action,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: action === "approved" ? t.admin.payoutApproved : t.admin.payoutRejected,
        description: t.admin.payoutUpdated,
      });

      fetchPayoutRequests();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.admin.errorUpdating;
      toast({
        title: t.common.error,
        description: message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const totalPlatformIncome = revenue.platformCredits + revenue.platformSuperchat + revenue.platformRegistration;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">{t.admin.title}</h1>
              <p className="text-sm text-muted-foreground">Gerencie a plataforma e monitore a receita</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/creators" className="w-full">
              <Button variant="outline" size="sm" className="w-full">
                <UserCheck className="h-4 w-4 mr-2" />
                <span className="truncate">{t.admin.manageCreators}</span>
              </Button>
            </Link>
            <Link to="/admin/pix-withdrawals" className="w-full">
              <Button variant="outline" size="sm" className="w-full">
                <Banknote className="h-4 w-4 mr-2" />
                <span className="truncate">Saques PIX</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t.admin.totalUsers}</CardTitle>
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-3xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t.admin.totalCreators}</CardTitle>
              <Video className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-3xl font-bold">{stats.totalCreators}</div>
            </CardContent>
          </Card>

          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t.admin.onlineNow}</CardTitle>
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-3xl font-bold text-green-500">{stats.onlineCreators}</div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t.admin.platformRevenue}</CardTitle>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-3xl font-bold text-yellow-500">{formatBRL(totalPlatformIncome)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Dashboard */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Wallet className="h-5 w-5 text-primary" />
              Dashboard de Receita da Plataforma
            </CardTitle>
            <CardDescription>Visão detalhada das finanças da plataforma</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Card className="bg-primary/10 border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-8 w-8 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Receita Total da Plataforma</p>
                      <p className="text-2xl sm:text-3xl font-bold text-primary">{formatBRL(totalPlatformIncome)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <ArrowDownCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Saques</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-500">{formatBRL(revenue.totalWithdrawals)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Income Breakdown - 3 Cards */}
            <div>
              <h4 className="font-semibold mb-3 text-sm sm:text-base">Entradas por Tipo</h4>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <Card style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <CreditCard className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Créditos</p>
                        <p className="text-xs text-muted-foreground/70">Bruto: {formatBRL(revenue.creditsIncome)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-2xl text-blue-500">+{formatBRL(revenue.platformCredits)}</p>
                  </CardContent>
                </Card>

                <Card style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <MessageSquare className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">SuperChats</p>
                        <p className="text-xs text-muted-foreground/70">Bruto: {formatBRL(revenue.superchatIncome)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-2xl text-yellow-500">+{formatBRL(revenue.platformSuperchat)}</p>
                  </CardContent>
                </Card>

                <Card style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <UserPlus className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Cadastros</p>
                        <p className="text-xs text-muted-foreground/70">Bruto: {formatBRL(revenue.registrationIncome)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-2xl text-green-500">+{formatBRL(revenue.platformRegistration)}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Platform Balance */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-lg font-semibold">Saldo Líquido da Plataforma</span>
                <span className={`text-2xl sm:text-3xl font-bold ${revenue.platformBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatBRL(revenue.platformBalance)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout Requests */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              {t.admin.payoutRequests}
            </CardTitle>
            <CardDescription>{t.admin.payoutRequestsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {payoutRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Banknote className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t.admin.noPendingPayouts}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.admin.creator}</TableHead>
                      <TableHead>{t.admin.amount}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t.admin.bankAccount}</TableHead>
                      <TableHead>{t.admin.status}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t.admin.date}</TableHead>
                      <TableHead>{t.admin.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.profiles?.username || request.creator_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          {formatBRL(request.amount)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {request.creator_bank_accounts?.bank_name || 'N/A'}<br />
                          <span className="text-xs text-muted-foreground">
                            {request.creator_bank_accounts?.account_number || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            request.status === 'pending' ? 'secondary' :
                            request.status === 'approved' ? 'default' :
                            'destructive'
                          }>
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handlePayoutAction(request.id, 'approved')}
                              >
                                {t.admin.approve}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handlePayoutAction(request.id, 'rejected')}
                              >
                                {t.admin.reject}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
