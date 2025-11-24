import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Users, Video, TrendingUp } from "lucide-react";

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCreators: 0,
    onlineCreators: 0,
    totalRevenue: 0,
  });
  const [financialSettings, setFinancialSettings] = useState({
    subscription_price: 5.00,
    creator_percentage: 80,
    platform_percentage: 20,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

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
        const metaRoles = (session.user.app_metadata as any)?.roles || (session.user.user_metadata as any)?.roles;
        const primaryRole =
          (session.user.app_metadata as any)?.app_role ||
          (session.user.user_metadata as any)?.app_role ||
          (session.user.app_metadata as any)?.role ||
          (session.user.user_metadata as any)?.role;

        const normalized = new Set<string>();
        if (Array.isArray(metaRoles)) {
          metaRoles.forEach((r) => normalized.add(String(r).toLowerCase()));
        } else if (typeof metaRoles === "string") {
          normalized.add(metaRoles.toLowerCase());
        }
        if (primaryRole) {
          normalized.add(String(primaryRole).toLowerCase());
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
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await Promise.all([
        fetchStats(),
        fetchPayoutRequests(),
        fetchFinancialSettings(),
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

      const totalRevenue = revenueRes.data?.reduce((sum, t) => sum + (t.platform_amount || 0), 0) || 0;

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

  const fetchPayoutRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("payout_requests")
        .select(`
          *,
          profiles!payout_requests_creator_id_fkey(username, email),
          creator_bank_accounts(account_holder_name, bank_name, account_number)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayoutRequests(data || []);
    } catch (error) {
      console.error("Error fetching payout requests:", error);
    }
  };

  const fetchFinancialSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("financial_settings")
        .select("*")
        .single();

      if (error) throw error;
      if (data) {
        setFinancialSettings({
          subscription_price: data.subscription_price,
          creator_percentage: data.creator_percentage,
          platform_percentage: data.platform_percentage,
        });
      }
    } catch (error) {
      console.error("Error fetching financial settings:", error);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const { error } = await supabase
        .from("financial_settings")
        .update(financialSettings)
        .eq("id", (await supabase.from("financial_settings").select("id").single()).data?.id);

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: "Financial settings have been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePayoutAction = async (requestId: string, action: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("payout_requests")
        .update({
          status: action,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: `Payout ${action}`,
        description: `The payout request has been ${action}`,
      });

      fetchPayoutRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-primary">Admin Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
              <Video className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCreators}</div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Online Now</CardTitle>
              <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.onlineCreators}</div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Settings */}
        <Card className="mb-8 border-primary/20">
          <CardHeader>
            <CardTitle>Financial Settings</CardTitle>
            <CardDescription>Manage subscription pricing and revenue splits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Subscription Price (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={financialSettings.subscription_price}
                  onChange={(e) => setFinancialSettings({
                    ...financialSettings,
                    subscription_price: parseFloat(e.target.value)
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creator">Creator % (currently 80%)</Label>
                <Input
                  id="creator"
                  type="number"
                  value={financialSettings.creator_percentage}
                  onChange={(e) => setFinancialSettings({
                    ...financialSettings,
                    creator_percentage: parseInt(e.target.value),
                    platform_percentage: 100 - parseInt(e.target.value)
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">Platform % (currently 20%)</Label>
                <Input
                  id="platform"
                  type="number"
                  value={financialSettings.platform_percentage}
                  disabled
                />
              </div>
            </div>
            <Button onClick={handleUpdateSettings}>
              Update Settings
            </Button>
          </CardContent>
        </Card>

        {/* Payout Requests */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Payout Requests</CardTitle>
            <CardDescription>Review and approve creator withdrawal requests</CardDescription>
          </CardHeader>
          <CardContent>
            {payoutRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No pending payout requests</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.profiles?.username || 'Unknown'}</TableCell>
                      <TableCell>R$ {request.amount.toFixed(2)}</TableCell>
                      <TableCell>
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
                      <TableCell>
                        {new Date(request.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handlePayoutAction(request.id, 'approved')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handlePayoutAction(request.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
