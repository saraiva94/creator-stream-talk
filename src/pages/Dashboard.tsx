import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clipboard, Loader2, User, Video, Wallet } from "lucide-react";

import Navbar from "@/components/Navbar";
import LiveStartForm from "@/components/LiveStartForm";
import { JitsiPlayer } from "@/components/JitsiPlayer";
import ReferralLinkBox from "@/components/ReferralLinkBox";
import { supabase } from "@/integrations/supabase/client";
import { api, AffiliateStatsResponse, CreatorBalanceSnapshot, LiveAnalyticsSnapshot, LiveSummary } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileSummary {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface CreatorDetails {
  id: string;
  bio?: string | null;
}

const PREVIEWABLE_STATUSES = new Set(["waiting_for_host", "live"]);

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [creator, setCreator] = useState<CreatorDetails | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState<LiveSummary | null>(null);
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const session = data.session;
      if (!session) {
        navigate("/auth");
        return;
      }

      const [profileRes, creatorRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, username, avatar_url")
          .eq("id", session.user.id)
          .single(),
        supabase.from("creators").select("id, bio").eq("user_id", session.user.id).single(),
      ]);

      if (!mounted) return;

      if (profileRes.error) {
        setProfileError(profileRes.error.message);
      } else {
        setProfile(profileRes.data);
      }

      if (!creatorRes.error) {
        setCreator(creatorRes.data);
      }

      setSessionReady(true);
    };

    bootstrap().catch((error) => {
      console.error("[dashboard] bootstrap failed", error);
      if (mounted) {
        setProfileError("Unable to load your profile");
        setSessionReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLiveUpdated = useCallback((live: LiveSummary | null) => {
    setLiveSnapshot(live);
  }, []);

  const balanceQuery = useQuery<{ snapshot: CreatorBalanceSnapshot } | CreatorBalanceSnapshot, Error>({
    queryKey: ["creator", "balance"],
    queryFn: async () => api.creators.balance(),
    enabled: sessionReady,
  });

  const affiliateStatsQuery = useQuery<AffiliateStatsResponse, Error>({
    queryKey: ["creator", "affiliate", "stats"],
    queryFn: async () => api.affiliates.stats(),
    enabled: sessionReady,
  });

  const referralQuery = useQuery({
    queryKey: ["creator", "referral", "link"],
    queryFn: async () => api.affiliates.referralLink(),
    enabled: sessionReady,
  });

  const analyticsQuery = useQuery<LiveAnalyticsSnapshot>({
    queryKey: ["creator", "live", "analytics", liveSnapshot?.id],
    queryFn: async () => {
      if (!liveSnapshot?.id) throw new Error("Missing live id");
      return api.lives.analytics(liveSnapshot.id);
    },
    enabled: sessionReady && Boolean(liveSnapshot?.id),
    refetchInterval: 5000,
  });

  const balance = useMemo<CreatorBalanceSnapshot | null>(() => {
    const data = balanceQuery.data as CreatorBalanceSnapshot | undefined;
    return data ?? null;
  }, [balanceQuery.data]);

  const analytics = useMemo<LiveAnalyticsSnapshot | null>(() => analyticsQuery.data ?? null, [analyticsQuery.data]);

  useEffect(() => {
    if (analytics?.live_duration_ms != null) {
      setLiveDurationMs(analytics.live_duration_ms);
    }
  }, [analytics?.live_duration_ms]);

  useEffect(() => {
    setLiveDurationMs(0);
    if (!liveSnapshot?.id) return undefined;
    const timer = setInterval(() => {
      setLiveDurationMs((current) => current + 1000);
    }, 1000);
    return () => clearInterval(timer);
  }, [liveSnapshot?.id]);

  const hasLivePreview = Boolean(
    liveSnapshot?.room_name && PREVIEWABLE_STATUSES.has(liveSnapshot.status ?? "")
  );

  const affiliateStats = useMemo<AffiliateStatsResponse | null>(() => {
    return affiliateStatsQuery.data ?? null;
  }, [affiliateStatsQuery.data]);

  const referralCode = useMemo(() => referralQuery.data?.referral_link?.code ?? null, [referralQuery.data]);

  const creatorName = profile?.username || profile?.email || "Creator";
  const creatorBio = creator?.bio || "Share more about your content to help viewers find you.";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto space-y-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Creator profile
            </CardTitle>
            <CardDescription>Basic information loaded directly from Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {profile ? (
              <div className="flex flex-1 items-center gap-4">
                <Avatar className="h-16 w-16">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={creatorName} />
                  ) : (
                    <AvatarFallback>{creatorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{creatorName}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{creatorBio}</p>
                </div>
              </div>
            ) : profileError ? (
              <p className="text-sm text-destructive">{profileError}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <LiveStartForm onLiveUpdated={handleLiveUpdated} showEmbeddedPlayer={false} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" /> Finance summary
              </CardTitle>
              <CardDescription>Snapshot of balances, referrals, and withdrawals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {balanceQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading balances...
                </div>
              ) : balanceQuery.isError ? (
                <p className="text-sm text-destructive">Failed to load balance data.</p>
              ) : balance ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Available balance</p>
                    <p className="text-2xl font-semibold">${balance.balance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Pending withdrawals</p>
                    <p className="text-2xl font-semibold">${balance.pending_withdrawals.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Total earned</p>
                    <p className="text-2xl font-semibold">${balance.total_earned.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Affiliate earnings</p>
                    <p className="text-2xl font-semibold">${balance.total_affiliate_earned.toFixed(2)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Balance data unavailable.</p>
              )}

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Creator %</p>
                  <p>{liveSnapshot?.creator_percent ?? "-"}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Platform %</p>
                  <p>{liveSnapshot?.platform_percent ?? "-"}%</p>
                </div>
              </div>

              <Button variant="secondary" disabled className="w-full">
                Withdraw (coming soon)
              </Button>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> Live analytics
            </CardTitle>
            <CardDescription>Real-time viewer and credit signals for your active live.</CardDescription>
          </CardHeader>
          <CardContent>
            {!liveSnapshot ? (
              <p className="text-sm text-muted-foreground">Start a live to view analytics.</p>
            ) : analyticsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics...
              </div>
            ) : analytics ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <AnalyticsStat label="Current viewers" value={analytics.current_viewers} />
                <AnalyticsStat label="Total unique viewers" value={analytics.total_unique_viewers} />
                <AnalyticsStat label="Credits consumed" value={analytics.credits_consumed_total} />
                <AnalyticsStat
                  label="Avg credits remaining/viewer"
                  value={Math.round(analytics.credits_remaining_average)}
                />
                <AnalyticsStat label="Live duration" value={formatDuration(liveDurationMs)} />
                <AnalyticsStat
                  label="Estimated earnings"
                  value={
                    analytics.estimated_earnings
                      ? `R$ ${(analytics.estimated_earnings / 100).toFixed(2)}`
                      : 'R$ 0.00'
                  }
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Analytics unavailable for this live.</p>
            )}
          </CardContent>
        </Card>

        <Card id="registration-earnings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clipboard className="h-5 w-5" /> Registration earnings
            </CardTitle>
            <CardDescription>Track commissions from signup referrals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {affiliateStatsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading registration earnings...
              </div>
            ) : affiliateStatsQuery.isError ? (
              <p className="text-sm text-destructive">Failed to load registration earnings.</p>
            ) : affiliateStats ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AnalyticsStat
                  label="Total earnings"
                  value={`R$ ${(affiliateStats.total_affiliate_earnings / 100).toFixed(2)}`}
                />
                <AnalyticsStat label="Direct referrals" value={affiliateStats.direct_referrals} />
                <AnalyticsStat label="Indirect referrals" value={affiliateStats.indirect_referrals} />
                <AnalyticsStat label="Registrations referred" value={affiliateStats.registrations_referred} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No referral earnings available yet.</p>
            )}

            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Earn R$1,00 for direct registrations and R$0,50 for indirect signups when referrals join via
              your link. Platform keeps the remainder per the registration paywall rules.
            </div>

            <ReferralLinkBox
              referralCode={referralCode}
              loading={referralQuery.isLoading}
              onRefresh={() => referralQuery.refetch()}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Request a payout of your registration earnings.</p>
              <Button variant="secondary" onClick={() => navigate("/admin")}>Withdraw earnings</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> Live preview
            </CardTitle>
            <CardDescription>Monitor your active Jitsi room directly from the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasLivePreview && liveSnapshot?.room_name ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Room:</span>
                  <Badge variant="outline" className="font-mono">
                    {liveSnapshot.room_name}
                  </Badge>
                  <span>
                    Status: {liveSnapshot.status ? liveSnapshot.status.replace(/_/g, " ") : "Unknown"}
                  </span>
                </div>
                <div className="rounded-lg border">
                  <JitsiPlayer roomName={liveSnapshot.room_name} height="500px" />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Start a live session to see the Jitsi preview here. Lives that are inactive or ended will not appear.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

const AnalyticsStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-md border p-3">
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold">{value}</p>
  </div>
);

export default Dashboard;
