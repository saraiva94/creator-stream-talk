import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, Video, TrendingUp, UserCheck, Wallet, CreditCard, MessageSquare, UserPlus, ArrowDownCircle, Shield, ChevronDown, ChevronUp, Search, Ban, CheckCircle, XCircle, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { WebhookLogsPanel } from "@/components/admin/WebhookLogsPanel";
import { useLanguage } from "@/hooks/useLanguage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

type UserProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  status: string | null;
};

type CreatorProfile = {
  id: string;
  display_name: string;
  is_streaming: boolean;
  approved_for_live: boolean;
  profiles?: {
    avatar_url: string | null;
  };
};


const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUsersList, setShowUsersList] = useState(false);
  const [showCreatorsList, setShowCreatorsList] = useState(false);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [creatorsList, setCreatorsList] = useState<CreatorProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [usersSearch, setUsersSearch] = useState("");
  const [creatorsSearch, setCreatorsSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [creatorsPage, setCreatorsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Confirmation dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "ban" | "unban" | "approve" | "revoke";
    targetId: string;
    targetName: string;
  } | null>(null);
  const [banReason, setBanReason] = useState("");
  
  // Pending payment processing
  const [pendingPaymentId, setPendingPaymentId] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Webhook test
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{
    success: boolean;
    accountInfo?: { id: number; email: string; nickname: string; first_name: string; last_name: string };
    expectedWebhookUrl?: string;
    instructions?: string[];
    error?: string;
  } | null>(null);
  
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

  const fetchUsersList = async () => {
    if (usersList.length > 0) {
      setShowUsersList(!showUsersList);
      return;
    }
    setLoadingUsers(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, created_at, status")
        .order("created_at", { ascending: false })
        .limit(100);
      setUsersList((data as UserProfile[]) || []);
      setShowUsersList(true);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCreatorsList = async () => {
    if (creatorsList.length > 0) {
      setShowCreatorsList(!showCreatorsList);
      return;
    }
    setLoadingCreators(true);
    try {
      const { data } = await supabase
        .from("creator_profiles")
        .select("id, display_name, is_streaming, approved_for_live")
        .order("created_at", { ascending: false })
        .limit(100);
      
      // Fetch avatars from profiles
      const creatorsWithAvatars = await Promise.all(
        (data || []).map(async (creator) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", creator.id)
            .maybeSingle();
          return { ...creator, profiles: profile };
        })
      );
      
      setCreatorsList(creatorsWithAvatars as CreatorProfile[]);
      setShowCreatorsList(true);
    } catch (error) {
      console.error("Error fetching creators:", error);
    } finally {
      setLoadingCreators(false);
    }
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    if (!usersSearch.trim()) return usersList;
    const search = usersSearch.toLowerCase();
    return usersList.filter((u) => u.username?.toLowerCase().includes(search));
  }, [usersList, usersSearch]);

  const filteredCreators = useMemo(() => {
    if (!creatorsSearch.trim()) return creatorsList;
    const search = creatorsSearch.toLowerCase();
    return creatorsList.filter((c) => c.display_name?.toLowerCase().includes(search));
  }, [creatorsList, creatorsSearch]);

  // Paginated lists
  const paginatedUsers = useMemo(() => {
    const startIndex = (usersPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, usersPage]);

  const paginatedCreators = useMemo(() => {
    const startIndex = (creatorsPage - 1) * ITEMS_PER_PAGE;
    return filteredCreators.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCreators, creatorsPage]);

  const totalUsersPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const totalCreatorsPages = Math.ceil(filteredCreators.length / ITEMS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => {
    setUsersPage(1);
  }, [usersSearch]);

  useEffect(() => {
    setCreatorsPage(1);
  }, [creatorsSearch]);

  // Confirmation handlers
  const openBanConfirmation = (userId: string, username: string, isBanned: boolean) => {
    setConfirmDialog({
      open: true,
      type: isBanned ? "unban" : "ban",
      targetId: userId,
      targetName: username,
    });
  };

  const openCreatorConfirmation = (creatorId: string, displayName: string, isApproved: boolean) => {
    setConfirmDialog({
      open: true,
      type: isApproved ? "revoke" : "approve",
      targetId: creatorId,
      targetName: displayName,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    
    if (confirmDialog.type === "ban" || confirmDialog.type === "unban") {
      await handleBanUser(confirmDialog.targetId, confirmDialog.type === "unban" ? "banned" : "active", banReason);
    } else {
      await handleApproveCreator(confirmDialog.targetId, confirmDialog.type === "approve");
    }
    
    setConfirmDialog(null);
    setBanReason("");
  };

  // User management actions
  const handleBanUser = async (userId: string, currentStatus: string | null, reason?: string) => {
    const newStatus = currentStatus === "banned" ? "active" : "banned";
    setActionLoading(userId);
    try {
      const updateData: { status: string; blocked_reason?: string | null } = { status: newStatus };
      
      // Add or clear blocked_reason based on action
      if (newStatus === "banned" && reason?.trim()) {
        updateData.blocked_reason = reason.trim();
      } else if (newStatus === "active") {
        updateData.blocked_reason = null;
      }
      
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);
      
      if (error) throw error;
      
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      
      toast({
        title: newStatus === "banned" ? t.admin.userBanned : t.admin.userReactivated,
        description: newStatus === "banned" ? t.admin.userBannedDesc : t.admin.userReactivatedDesc,
      });
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({
        title: t.admin.error,
        description: t.admin.errorUpdatingStatus,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Creator management actions
  const handleApproveCreator = async (creatorId: string, approve: boolean) => {
    setActionLoading(creatorId);
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({ approved_for_live: approve })
        .eq("id", creatorId);
      
      if (error) throw error;
      
      setCreatorsList((prev) =>
        prev.map((c) => (c.id === creatorId ? { ...c, approved_for_live: approve } : c))
      );
      
      toast({
        title: approve ? t.admin.creatorApproved : t.admin.approvalRevoked,
        description: approve 
          ? t.admin.creatorApprovedDesc 
          : t.admin.approvalRevokedDesc,
      });
    } catch (error) {
      console.error("Error updating creator approval:", error);
      toast({
        title: t.admin.error,
        description: t.admin.errorUpdatingApproval,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Process pending payment manually
  const handleProcessPendingPayment = async () => {
    if (!pendingPaymentId.trim()) {
      toast({
        title: "Erro",
        description: "Insira o ID do pagamento",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("process-pending-payment", {
        body: { paymentId: pendingPaymentId.trim() },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to process payment");
      }

      const result = response.data;
      
      if (result.duplicate) {
        toast({
          title: "Pagamento já processado",
          description: "Este pagamento já foi processado anteriormente.",
        });
      } else if (result.error) {
        throw new Error(result.error);
      } else {
        toast({
          title: "Pagamento processado!",
          description: `Tipo: ${result.processed}, Valor: R$ ${result.amount?.toFixed(2)}`,
        });
        // Refresh stats
        fetchStats();
        fetchRevenueBreakdown();
      }

      setPendingPaymentId("");
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Erro ao processar pagamento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Test webhook connection
  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("webhook-test");

      if (response.error) {
        throw new Error(response.error.message || "Failed to test webhook");
      }

      setWebhookTestResult(response.data);
      
      if (response.data.success) {
        toast({
          title: "Conexão com Mercado Pago OK!",
          description: `Conta: ${response.data.accountInfo?.email || response.data.accountInfo?.nickname}`,
        });
      } else {
        toast({
          title: "Erro na conexão",
          description: response.data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      toast({
        title: "Erro ao testar webhook",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

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
    <AppLayout showSidebar={false}>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">{t.admin.title}</h1>
              <p className="text-sm text-muted-foreground">{t.admin.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/creators">
              <Button variant="outline" size="sm">
                <UserCheck className="h-4 w-4 mr-2" />
                <span className="truncate">{t.admin.manageCreators}</span>
              </Button>
            </Link>
            <Link to="/admin/pix-withdrawals">
              <Button variant="outline" size="sm">
                <Wallet className="h-4 w-4 mr-2" />
                <span className="truncate">Saques PIX</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Process Pending Payment */}
        <Card className="mb-6 sm:mb-8 border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-yellow-500" />
              Processar Pagamento Pendente
            </CardTitle>
            <CardDescription>
              Se um pagamento foi feito mas não apareceu no sistema, insira o ID da transação do Mercado Pago para processar manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="flex gap-2">
              <Input
                placeholder="ID do pagamento (ex: 136354297753)"
                value={pendingPaymentId}
                onChange={(e) => setPendingPaymentId(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleProcessPendingPayment}
                disabled={processingPayment || !pendingPaymentId.trim()}
              >
                {processingPayment ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Processar"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Test */}
        <Card className="mb-6 sm:mb-8 border-blue-500/30 bg-blue-500/5">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-blue-500" />
              Testar Webhook do Mercado Pago
            </CardTitle>
            <CardDescription>
              Verifique se a conexão com o Mercado Pago está funcionando e se o webhook está configurado corretamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            <Button 
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              variant="outline"
            >
              {testingWebhook ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Testando...
                </>
              ) : (
                "Testar Conexão"
              )}
            </Button>
            
            {webhookTestResult && (
              <div className={`p-4 rounded-lg ${webhookTestResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                {webhookTestResult.success ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-500">Conexão OK!</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Conta: {webhookTestResult.accountInfo?.email || webhookTestResult.accountInfo?.nickname}
                    </p>
                    <p className="text-sm font-medium mb-2">URL do Webhook:</p>
                    <code className="block p-2 bg-background/50 rounded text-xs break-all mb-3">
                      {webhookTestResult.expectedWebhookUrl}
                    </code>
                    <p className="text-sm font-medium mb-1">Como configurar:</p>
                    <ol className="text-xs text-muted-foreground space-y-1">
                      {webhookTestResult.instructions?.map((instruction, i) => (
                        <li key={i}>{instruction}</li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-500">{webhookTestResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Total Users Card - Clickable */}
          <Card 
            className="bg-primary/5 border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={fetchUsersList}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t.admin.totalUsers}</CardTitle>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                {loadingUsers ? (
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  showUsersList ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-xl sm:text-3xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          {/* Total Creators Card - Clickable */}
          <Card 
            className="bg-blue-500/5 border-blue-500/20 cursor-pointer hover:bg-blue-500/10 transition-colors"
            onClick={fetchCreatorsList}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t.admin.totalCreators}</CardTitle>
              <div className="flex items-center gap-1">
                <Video className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                {loadingCreators ? (
                  <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  showCreatorsList ? <ChevronUp className="h-4 w-4 text-blue-500" /> : <ChevronDown className="h-4 w-4 text-blue-500" />
                )}
              </div>
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

        {/* Users List - Expandable */}
        {showUsersList && usersList.length > 0 && (
          <Card className="mb-6 sm:mb-8 border-primary/20">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {t.admin.usersList} ({filteredUsers.length})
                </div>
              </CardTitle>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.admin.searchUser}
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-2">
                {paginatedUsers.map((profile) => (
                  <div key={profile.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>{profile.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{profile.username}</p>
                        {profile.status === "banned" && (
                          <Badge variant="destructive" className="text-xs">{t.admin.banned}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={profile.status === "banned" ? "outline" : "destructive"}
                      onClick={() => openBanConfirmation(profile.id, profile.username, profile.status === "banned")}
                      disabled={actionLoading === profile.id}
                      className="flex-shrink-0"
                    >
                      {actionLoading === profile.id ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : profile.status === "banned" ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">{t.admin.reactivate}</span>
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">{t.admin.ban}</span>
                        </>
                      )}
                    </Button>
                  </div>
                ))}
                {paginatedUsers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">{t.admin.noUserFound}</p>
                )}
              </div>
              {/* Pagination */}
              {totalUsersPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    {t.admin.page} {usersPage} {t.admin.of} {totalUsersPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUsersPage((p) => Math.min(totalUsersPages, p + 1))}
                      disabled={usersPage === totalUsersPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Creators List - Expandable */}
        {showCreatorsList && creatorsList.length > 0 && (
          <Card className="mb-6 sm:mb-8 border-blue-500/20">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-blue-500" />
                  {t.admin.creatorsList} ({filteredCreators.length})
                </div>
              </CardTitle>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.admin.searchCreator}
                  value={creatorsSearch}
                  onChange={(e) => setCreatorsSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-2">
                {paginatedCreators.map((creator) => (
                  <div key={creator.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={creator.profiles?.avatar_url || undefined} />
                      <AvatarFallback>{creator.display_name?.[0]?.toUpperCase() || "C"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{creator.display_name}</p>
                        {creator.is_streaming && (
                          <Badge className="bg-green-500/20 text-green-500 text-xs">
                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-1" />
                            {t.admin.live}
                          </Badge>
                        )}
                        {creator.approved_for_live ? (
                          <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">{t.admin.approved}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-500">{t.admin.pending}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {creator.approved_for_live ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openCreatorConfirmation(creator.id, creator.display_name, true)}
                          disabled={actionLoading === creator.id}
                        >
                          {actionLoading === creator.id ? (
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">{t.admin.revoke}</span>
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openCreatorConfirmation(creator.id, creator.display_name, false)}
                          disabled={actionLoading === creator.id}
                        >
                          {actionLoading === creator.id ? (
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">{t.admin.approve}</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {paginatedCreators.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">{t.admin.noCreatorFound}</p>
                )}
              </div>
              {/* Pagination */}
              {totalCreatorsPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    {t.admin.page} {creatorsPage} {t.admin.of} {totalCreatorsPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreatorsPage((p) => Math.max(1, p - 1))}
                      disabled={creatorsPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreatorsPage((p) => Math.min(totalCreatorsPages, p + 1))}
                      disabled={creatorsPage === totalCreatorsPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => { if (!open) { setConfirmDialog(null); setBanReason(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmDialog?.type === "ban" && t.admin.confirmBan}
                {confirmDialog?.type === "unban" && t.admin.confirmUnban}
                {confirmDialog?.type === "approve" && t.admin.confirmApprove}
                {confirmDialog?.type === "revoke" && t.admin.confirmRevoke}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {confirmDialog?.type === "ban" && (
                    <p>{t.admin.confirmBanDesc} <strong>{confirmDialog.targetName}</strong>?</p>
                  )}
                  {confirmDialog?.type === "unban" && (
                    <p>{t.admin.confirmUnbanDesc} <strong>{confirmDialog?.targetName}</strong>?</p>
                  )}
                  {confirmDialog?.type === "approve" && (
                    <p>{t.admin.confirmApproveDesc} <strong>{confirmDialog?.targetName}</strong>?</p>
                  )}
                  {confirmDialog?.type === "revoke" && (
                    <p>{t.admin.confirmRevokeDesc} <strong>{confirmDialog?.targetName}</strong>?</p>
                  )}
                  {confirmDialog?.type === "ban" && (
                    <div className="pt-2">
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        {t.common.banReasonLabel}
                      </label>
                      <textarea
                        className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder={t.common.banReasonPlaceholder}
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmAction}
                className={confirmDialog?.type === "ban" || confirmDialog?.type === "revoke" ? "bg-destructive hover:bg-destructive/90" : ""}
              >
                {t.common.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Revenue Dashboard */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Wallet className="h-5 w-5 text-primary" />
              {t.admin.revenueBreakdown}
            </CardTitle>
            <CardDescription>{t.admin.revenueBreakdownDesc}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Card className="bg-primary/10 border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-8 w-8 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.admin.totalPlatformIncome}</p>
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
                      <p className="text-sm text-muted-foreground">{t.admin.totalWithdrawals}</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-500">{formatBRL(revenue.totalWithdrawals)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Income Breakdown - 3 Cards */}
            <div>
              <h4 className="font-semibold mb-3 text-sm sm:text-base">{t.revenue.entriesByType}</h4>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <Card style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <CreditCard className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t.revenue.credits}</p>
                        <p className="text-xs text-muted-foreground/70">{t.revenue.gross}: {formatBRL(revenue.creditsIncome)}</p>
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
                        <p className="text-sm text-muted-foreground">{t.revenue.superchats}</p>
                        <p className="text-xs text-muted-foreground/70">{t.revenue.gross}: {formatBRL(revenue.superchatIncome)}</p>
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
                        <p className="text-sm text-muted-foreground">{t.revenue.registrations}</p>
                        <p className="text-xs text-muted-foreground/70">{t.revenue.gross}: {formatBRL(revenue.registrationIncome)}</p>
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
                <span className="text-lg font-semibold">{t.admin.netPlatformBalance}</span>
                <span className={`text-2xl sm:text-3xl font-bold ${revenue.platformBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatBRL(revenue.platformBalance)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Logs Panel */}
        <WebhookLogsPanel />

      </main>
    </AppLayout>
  );
};

export default Admin;
