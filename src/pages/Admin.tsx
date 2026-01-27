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
import PromotionalVideosPanel from "@/components/admin/PromotionalVideosPanel";
import PromoVideoAnalyticsPanel from "@/components/admin/PromoVideoAnalyticsPanel";
import { ContentReportsPanel } from "@/components/admin/ContentReportsPanel";
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
  liveEarningsIncome: number;
  platformCredits: number;
  platformSuperchat: number;
  platformRegistration: number;
  platformLiveEarnings: number;
  totalWithdrawals: number;
  platformBalance: number;
};

type UserProfile = {
  id: string;
  username: string;
  email?: string | null;
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
  
  // Backfill revenue
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean;
    processed: number;
    skipped: number;
    results?: Array<{ username: string; platformAmountCents: number }>;
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
    liveEarningsIncome: 0,
    platformCredits: 0,
    platformSuperchat: 0,
    platformRegistration: 0,
    platformLiveEarnings: 0,
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
      // Buscar profiles com email de auth.users via função ou diretamente
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, created_at, status")
        .order("created_at", { ascending: false })
        .limit(100);
      
      // Buscar emails da tabela registration_referrals como fallback
      const userIds = (data || []).map(u => u.id);
      const { data: regData } = await supabase
        .from("registration_referrals")
        .select("user_id, email")
        .in("user_id", userIds);
      
      const emailMap = (regData || []).reduce((acc, r) => {
        if (r.user_id && r.email) acc[r.user_id] = r.email;
        return acc;
      }, {} as Record<string, string>);
      
      const usersWithEmail = (data || []).map(u => ({
        ...u,
        email: emailMap[u.id] || null
      }));
      setUsersList(usersWithEmail as UserProfile[]);
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
    return usersList.filter((u) => 
      u.username?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search)
    );
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

  // Backfill platform revenue for existing registrations
  const handleBackfillRevenue = async () => {
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("backfill-platform-revenue");

      if (response.error) {
        throw new Error(response.error.message || "Failed to backfill revenue");
      }

      setBackfillResult(response.data);
      
      if (response.data.success) {
        toast({
          title: "Receita atualizada!",
          description: `Processados: ${response.data.processed}, Ignorados: ${response.data.skipped}`,
        });
        // Refresh stats
        fetchStats();
        fetchRevenueBreakdown();
      } else {
        toast({
          title: "Erro no backfill",
          description: response.data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error backfilling revenue:", error);
      toast({
        title: "Erro ao atualizar receita",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setBackfillLoading(false);
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
      // Fetch from platform_revenue table (the source of truth)
      const { data: platformRevenue } = await supabase
        .from("platform_revenue")
        .select("amount, source_type, metadata");

      const { data: withdrawals } = await supabase
        .from("payout_requests")
        .select("amount, status")
        .in("status", ["approved", "paid"]);

      // platform_revenue.amount is stored in centavos
      let platformCreditsCents = 0;
      let platformSuperchatCents = 0;
      let platformRegistrationCents = 0;
      let platformLiveEarningsCents = 0;
      
      // Gross amounts from metadata
      let grossCreditsCents = 0;
      let grossSuperchatCents = 0;
      let grossRegistrationCents = 0;
      let grossLiveEarningsCents = 0;

      console.log("[Admin Revenue Debug] Raw platform_revenue:", platformRevenue);

      type PlatformRevenueRow = {
        amount: number | null;
        source_type: string;
        metadata: { gross_amount?: number; creator_amount?: number } | null;
      };

      (platformRevenue as PlatformRevenueRow[] | null)?.forEach((row) => {
        const amountCents = Number(row.amount) || 0;
        const grossCents = Number(row.metadata?.gross_amount) || 0;
        const creatorAmount = Number(row.metadata?.creator_amount) || 0;
        const sourceType = (row.source_type || "").toLowerCase();
        
        if (sourceType === "credits_purchase") {
          platformCreditsCents += amountCents;
          grossCreditsCents += grossCents || amountCents; // credits: platform = 100%
        } else if (sourceType === "superchat") {
          platformSuperchatCents += amountCents;
          // superchat: gross = platform (20%) + creator (80%), so gross = platform * 5
          grossSuperchatCents += grossCents || (amountCents * 5);
        } else if (sourceType === "registration") {
          platformRegistrationCents += amountCents;
          grossRegistrationCents += grossCents || 500; // R$5 per registration
        } else if (sourceType === "live_earnings") {
          platformLiveEarningsCents += amountCents;
          // live_earnings: gross = platform + creator
          grossLiveEarningsCents += grossCents || (amountCents + creatorAmount);
        }
      });

      // Convert centavos to reais
      const platformCredits = platformCreditsCents / 100;
      const platformSuperchat = platformSuperchatCents / 100;
      const platformRegistration = platformRegistrationCents / 100;
      const platformLiveEarnings = platformLiveEarningsCents / 100;
      
      const creditsIncome = grossCreditsCents / 100;
      const superchatIncome = grossSuperchatCents / 100;
      const registrationIncome = grossRegistrationCents / 100;
      const liveEarningsIncome = grossLiveEarningsCents / 100;

      console.log("[Admin Revenue Debug] Calculated values:", {
        platformCredits,
        platformSuperchat,
        platformRegistration,
        platformLiveEarnings,
        creditsIncome,
        superchatIncome,
        registrationIncome,
        liveEarningsIncome,
      });

      // payout_requests.amount is also in centavos
      const totalWithdrawalsCents = withdrawals?.reduce((sum, w) => sum + (Number(w.amount) || 0), 0) || 0;
      const totalWithdrawals = totalWithdrawalsCents / 100;
      
      const totalIncome = platformCredits + platformSuperchat + platformRegistration + platformLiveEarnings;
      const platformBalance = totalIncome - totalWithdrawals;

      console.log("[Admin Revenue Debug] Final revenue:", {
        platformCredits,
        platformSuperchat,
        platformRegistration,
        platformLiveEarnings,
        totalIncome,
        totalWithdrawals,
        platformBalance,
      });

      setRevenue({
        creditsIncome,
        superchatIncome,
        registrationIncome,
        liveEarningsIncome,
        platformCredits,
        platformSuperchat,
        platformRegistration,
        platformLiveEarnings,
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

  const totalPlatformIncome = revenue.platformCredits + revenue.platformSuperchat + revenue.platformRegistration + revenue.platformLiveEarnings;

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

        {/* Quick Stats - FIRST SECTION */}
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

        {/* Users List - Expandable (after clicking Total Users) */}
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
                  <div 
                    key={profile.id} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border cursor-pointer group"
                  >
                    <Link 
                      to={`/u/${profile.username}`} 
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <Avatar className="h-10 w-10 group-hover:ring-2 ring-primary transition-all">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>{profile.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{profile.username}</p>
                          {profile.status === "banned" && (
                            <Badge variant="destructive" className="text-xs">{t.admin.banned}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.email && <span className="mr-2">{profile.email}</span>}
                          <span>{new Date(profile.created_at).toLocaleDateString("pt-BR")}</span>
                        </p>
                      </div>
                    </Link>
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

        {/* Creators List - Expandable (after clicking Total Creators) */}
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

        {/* Revenue Dashboard - SECOND SECTION */}
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

            {/* Income Breakdown - 4 Cards */}
            <div>
              <h4 className="font-semibold mb-3 text-sm sm:text-base">{t.revenue.entriesByType}</h4>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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

                <Card style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Consumo Lives</p>
                        <p className="text-xs text-muted-foreground/70">{t.revenue.gross}: {formatBRL(revenue.liveEarningsIncome)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-2xl text-purple-500">+{formatBRL(revenue.platformLiveEarnings)}</p>
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

        {/* ========================================== */}
        {/* CATEGORIA: MARKETING & CONTEÚDO */}
        {/* ========================================== */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Video className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Marketing & Conteúdo</h2>
          </div>
          <div className="space-y-4">
            <PromotionalVideosPanel />
            <PromoVideoAnalyticsPanel />
          </div>
        </section>

        {/* ========================================== */}
        {/* CATEGORIA: FERRAMENTAS FINANCEIRAS */}
        {/* ========================================== */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Ferramentas Financeiras</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Backfill Platform Revenue */}
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Receita Retroativa
                </CardTitle>
                <CardDescription className="text-xs">
                  Atualiza registros passados que não tiveram receita processada.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <Button 
                  size="sm"
                  onClick={handleBackfillRevenue}
                  disabled={backfillLoading}
                  variant="outline"
                  className="w-full border-green-500/50 hover:bg-green-500/10"
                >
                  {backfillLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    "Atualizar Receita"
                  )}
                </Button>
                
                {backfillResult && (
                  <div className={`p-3 rounded-lg text-xs ${backfillResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                    {backfillResult.success ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="font-medium text-green-500">Atualizado!</span>
                        </div>
                        <p className="text-muted-foreground">
                          {backfillResult.processed} processados, {backfillResult.skipped} ignorados
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <span className="text-red-500 break-words">{backfillResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Velana Info */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-blue-500" />
                  Pagamentos via Velana
                </CardTitle>
                <CardDescription className="text-xs">
                  A plataforma usa Velana para pagamentos PIX.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground">
                  Cash-In e Cash-Out são processados automaticamente via webhooks Velana. 
                  Consulte os logs de webhook para verificar transações.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ========================================== */}
        {/* CATEGORIA: MODERAÇÃO & LOGS */}
        {/* ========================================== */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Moderação & Logs</h2>
          </div>
          <div className="space-y-4">
            <ContentReportsPanel />
            <WebhookLogsPanel />
          </div>
        </section>

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

      </main>
    </AppLayout>
  );
};

export default Admin;
