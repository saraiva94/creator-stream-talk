import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ShieldOff, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import type { User } from "@supabase/supabase-js";

type CreatorRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  isApprovedForLive: boolean;
  createdAt: string;
};

const AdminCreators = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // Check admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      
      const isAdmin = roles?.some((r) => r.role === "admin") || false;
      if (!isAdmin) {
        toast({
          title: t.admin?.accessDenied || "Access denied",
          description: t.admin?.noPermission || "You don't have permission to access this page",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      fetchCreators();
    };
    checkAuth();
  }, [navigate, toast]);

  const fetchCreators = async () => {
    setLoading(true);
    setError(null);
    try {
      // Direct Supabase query for creator profiles
      const { data: creatorProfiles, error: cpError } = await supabase
        .from("creator_profiles")
        .select("id, display_name, approved_for_live, created_at")
        .order("created_at", { ascending: false });

      if (cpError) throw cpError;

      // Get profile info for each creator
      const creatorIds = (creatorProfiles ?? []).map((cp) => cp.id);
      
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", creatorIds);

      if (pError) throw pError;

      // Get auth emails (using profiles for now since we can't access auth.users)
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

      const mapped: CreatorRow[] = (creatorProfiles ?? []).map((cp) => ({
        id: cp.id,
        email: null, // Can't access auth.users from client
        username: profileMap.get(cp.id)?.username ?? null,
        display_name: cp.display_name,
        isApprovedForLive: cp.approved_for_live ?? false,
        createdAt: cp.created_at,
      }));

      setCreators(mapped);
    } catch (err) {
      console.error("[admin-creators] fetch error:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };


  const toggleApproval = async (creatorId: string, nextValue: boolean) => {
    setUpdatingId(creatorId);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({ approved_for_live: nextValue })
        .eq("id", creatorId);

      if (updateError) throw updateError;

      setCreators((prev) =>
        prev.map((c) =>
          c.id === creatorId ? { ...c, isApprovedForLive: nextValue } : c
        )
      );

      toast({
        title: nextValue 
          ? (t.adminCreators?.approved || "Creator approved!") 
          : (t.adminCreators?.revoke || "Approval revoked"),
        description: nextValue
          ? (t.live?.pendingApproval ? "" : "The creator can now start lives.")
          : (t.live?.pendingApproval ? "" : "The creator can no longer start lives."),
      });
    } catch (err) {
      console.error("[admin-creators] toggle error:", err);
      setError((err as Error).message);
      toast({
        title: t.common?.error || "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR");

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{t.adminCreators?.title || "Manage Creators"}</h1>
              <p className="text-muted-foreground">{t.adminCreators?.subtitle || "Review and approve creator accounts"}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCreators} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t.adminCreators?.refresh || "Refresh"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t.common?.error || "Error"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Lista de criadores ({creators.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.common?.loading || "Loading..."}
              </div>
            ) : creators.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">
                {t.adminCreators?.noCreators || "No creators found"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome de Exibição</TableHead>
                    <TableHead>{t.profile?.username || "Username"}</TableHead>
                    <TableHead>{t.admin?.status || "Status"}</TableHead>
                    <TableHead>{t.adminCreators?.createdAt || "Created"}</TableHead>
                    <TableHead className="text-right">{t.admin?.actions || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creators.map((creator) => (
                    <TableRow key={creator.id}>
                      <TableCell className="font-medium">{creator.display_name || "-"}</TableCell>
                      <TableCell>{creator.username || "-"}</TableCell>
                      <TableCell>
                        {creator.isApprovedForLive ? (
                          <Badge variant="default" className="bg-green-600">{t.adminCreators?.approved || "Approved"}</Badge>
                        ) : (
                          <Badge variant="secondary">{t.adminCreators?.pending || "Pending"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(creator.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={creator.isApprovedForLive ? "secondary" : "default"}
                          disabled={updatingId === creator.id}
                          onClick={() => toggleApproval(creator.id, !creator.isApprovedForLive)}
                        >
                          {updatingId === creator.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : creator.isApprovedForLive ? (
                            <>
                              <ShieldOff className="mr-1 h-4 w-4" /> {t.adminCreators?.revoke || "Revoke"}
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="mr-1 h-4 w-4" /> {t.adminCreators?.approve || "Approve"}
                            </>
                          )}
                        </Button>
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

export default AdminCreators;