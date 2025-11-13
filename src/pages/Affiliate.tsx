import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, TrendingUp, Link as LinkIcon, Copy } from "lucide-react";

interface Referral {
  id: string;
  referred_id: string;
  commission_earned: number;
  status: string;
  created_at: string;
  profiles: {
    username: string;
  };
}

const Affiliate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Get profile with referral code and balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code, balance")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setReferralCode(profile.referral_code || "");
        setBalance(profile.balance || 0);
      }

      // Get referrals
      const { data: referralsData } = await supabase
        .from("referrals")
        .select(`
          *
        `)
        .eq("referrer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (referralsData) {
        // Get usernames separately
        const referralsWithProfiles = await Promise.all(
          referralsData.map(async (ref) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", ref.referred_id)
              .single();
            
            return {
              ...ref,
              profiles: { username: profile?.username || "Usuário" }
            };
          })
        );
        
        setReferrals(referralsWithProfiles);
        const total = referralsWithProfiles.reduce(
          (sum, ref) => sum + (ref.commission_earned || 0),
          0
        );
        setTotalEarnings(total);
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Compartilhe com seus amigos",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Programa de Afiliados</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">
                Total de Indicações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{referrals.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">
                Comissões Ganhas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="text-3xl font-bold">
                  R$ {totalEarnings.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">
                Saldo Disponível
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">
                  R$ {balance.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Seu Link de Indicação
            </CardTitle>
            <CardDescription>
              Ganhe R$1,00 para cada amigo que assinar usando seu link. Seu
              amigo ganha R$0,50 de bônus!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={`${window.location.origin}/auth?ref=${referralCode}`}
                readOnly
              />
              <Button onClick={copyReferralLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Indicações</CardTitle>
            <CardDescription>
              Acompanhe suas indicações e comissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Você ainda não indicou ninguém</p>
                <p className="text-sm">
                  Compartilhe seu link e comece a ganhar!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">@{referral.profiles.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(referral.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">
                        +R$ {referral.commission_earned.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {referral.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Affiliate;
