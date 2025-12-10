import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import LivePreviewCard from "@/components/LivePreviewCard";
import UserSearchAutocomplete from "@/components/UserSearchAutocomplete";
import PublicProfileDialog from "@/components/PublicProfileDialog";
import HowToMonetizeDialog from "@/components/affiliate/HowToMonetizeDialog";
import { InstructionsDialog } from "@/components/InstructionsDialog";
import VideoCarousel from "@/components/VideoCarousel";
import LivesGridSkeleton from "@/components/LivesGridSkeleton";
import { useLanguage } from "@/hooks/useLanguage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, LiveSummary } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Home = () => {
  const [lives, setLives] = useState<LiveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string>("");
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    fetchLives();
  }, []);

  // Fetch user's referral code when logged in
  useEffect(() => {
    const fetchReferralCode = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("referral_code")
          .eq("id", user.id)
          .single();
        if (data?.referral_code) {
          setReferralCode(data.referral_code);
        }
      } catch (err) {
        console.error("Error fetching referral code:", err);
      }
    };
    fetchReferralCode();
  }, [user?.id]);

  const fetchLives = async () => {
    try {
      const response = await api.lives.getPublic();
      setLives(response.lives ?? []);
    } catch (err: unknown) {
      console.error("Error fetching lives:", err);
      setLives([]);
    } finally {
      setLoading(false);
    }
  };

  const onlineLives = lives.filter((live) => live.status !== "ended");
  const offlineLives = lives.filter((live) => live.status === "ended");

  // Open profile dialog instead of navigating
  const handleUserSelect = (selectedUser: { id: string; username: string }) => {
    setSelectedUserId(selectedUser.id);
    setSelectedUsername(selectedUser.username);
    setProfileDialogOpen(true);
  };

  const handleVideoClick = (live: LiveSummary) => {
    navigate(`/live/${live.id}`);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-4">
        <div className="text-center">
          <div className="max-w-lg mx-auto space-y-3">
            <UserSearchAutocomplete 
              onSelectUser={handleUserSelect}
              placeholder={t.home?.search || "Buscar usuários..."}
            />
            
            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <HowToMonetizeDialog 
                userId={user?.id} 
                initialCode={referralCode} 
                onCodeSaved={(newCode) => setReferralCode(newCode)} 
              />
              <InstructionsDialog />
            </div>
          </div>
        </div>

        {/* Video Carousel - closer to buttons */}
        <div className="-mt-4">
          <VideoCarousel 
            lives={onlineLives}
            onVideoClick={handleVideoClick}
            onLoginRequired={() => setShowLoginDialog(true)}
            isLoggedIn={!!user}
            userId={user?.id || null}
          />
        </div>

        {/* Lives Grid Section */}
        <section className="mt-4">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-primary flex items-center gap-2">
            <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-success rounded-full animate-pulse"></span>
            {t.home?.onlineNow || "Ao vivo agora"}
          </h2>
          
          {loading || authLoading ? (
            <LivesGridSkeleton />
          ) : onlineLives.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {onlineLives.map((live) => (
                <LivePreviewCard
                  key={live.id}
                  live={live}
                  isLoggedIn={!!user}
                  onLoginRequired={() => setShowLoginDialog(true)}
                />
              ))}
            </div>
          ) : (
            <LivesGridSkeleton />
          )}
        </section>

        {/* Offline Lives Section */}
        {offlineLives.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-muted-foreground">
              {t.home?.offline || "Offline"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {offlineLives.map((live) => (
                <LivePreviewCard
                  key={live.id}
                  live={live}
                  isLoggedIn={!!user}
                  onLoginRequired={() => setShowLoginDialog(true)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Login Dialog */}
        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-primary">{t.home?.loginToWatch || "Faça login para assistir"}</DialogTitle>
              <DialogDescription>
                {t.home?.loginDesc || "Create an account or sign in to watch live streams and interact with creators."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
              <Button
                className="flex-1"
                onClick={() => navigate("/auth")}
              >
                {t.home?.loginButton || "Entrar"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowLoginDialog(false)}
              >
                {t.common?.cancel || "Cancel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Public Profile Dialog */}
        <PublicProfileDialog
          isOpen={profileDialogOpen}
          onClose={() => setProfileDialogOpen(false)}
          userId={selectedUserId}
          username={selectedUsername}
        />
      </div>
    </AppLayout>
  );
};

export default Home;