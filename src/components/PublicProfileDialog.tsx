import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  UserPlus, 
  UserCheck, 
  ExternalLink,
  Youtube,
  Instagram,
  Globe,
  MessageCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate } from "react-router-dom";
import { FollowSettingsMenu } from "./FollowSettingsMenu";

interface PublicProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  username: string | null;
}

interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  youtube_handle: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  kwai_handle: string | null;
  facebook_handle: string | null;
  website: string | null;
  is_creator: boolean;
  is_streaming: boolean;
  follower_count: number;
}

export const PublicProfileDialog = ({ 
  isOpen, 
  onClose, 
  userId, 
  username 
}: PublicProfileDialogProps) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data: profileData, error } = await supabase
        .from("public_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      const { data: creatorData } = await supabase
        .from("creator_profiles")
        .select("id, is_streaming")
        .eq("id", userId)
        .maybeSingle();

      // Count followers using user_follows table
      const { count: followerCount } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

      // Check if current user is following
      if (currentUserId && currentUserId !== userId) {
        const { data: followData } = await supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", currentUserId)
          .eq("following_id", userId)
          .maybeSingle();
        
        setIsFollowing(!!followData);
      }

      setProfile({
        id: profileData.id!,
        username: profileData.username!,
        avatar_url: profileData.avatar_url,
        bio: profileData.bio,
        youtube_handle: profileData.youtube_handle,
        instagram_handle: profileData.instagram_handle,
        tiktok_handle: profileData.tiktok_handle,
        kwai_handle: profileData.kwai_handle,
        facebook_handle: profileData.facebook_handle,
        website: profileData.website,
        is_creator: !!creatorData,
        is_streaming: creatorData?.is_streaming || false,
        follower_count: followerCount || 0,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || !userId) return;
    
    try {
      if (isFollowing) {
        await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", userId);
        setIsFollowing(false);
        if (profile) {
          setProfile({ ...profile, follower_count: Math.max(0, profile.follower_count - 1) });
        }
      } else {
        await supabase
          .from("user_follows")
          .insert({
            follower_id: currentUserId,
            following_id: userId,
          });
        setIsFollowing(true);
        if (profile) {
          setProfile({ ...profile, follower_count: profile.follower_count + 1 });
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  const handleWatchLive = () => {
    if (profile?.is_streaming) {
      onClose();
      navigate(`/live/${profile.id}`);
    }
  };

  const handleViewFullProfile = () => {
    if (profile?.username) {
      onClose();
      navigate(`/u/${profile.username}`);
    }
  };

  const openSocialLink = (platform: string, handle: string | null) => {
    if (!handle) return;
    
    const urls: Record<string, string> = {
      youtube: `https://youtube.com/@${handle}`,
      instagram: `https://instagram.com/${handle}`,
      tiktok: `https://tiktok.com/@${handle}`,
      kwai: `https://kwai.com/@${handle}`,
      facebook: `https://facebook.com/${handle}`,
    };
    
    window.open(urls[platform], "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-primary/20">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {t.userProfile?.viewFullProfile || "View Profile"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profile ? (
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Avatar */}
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {profile.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            {/* Username and badges */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-xl font-bold">{profile.username}</h3>
                {profile.is_streaming && (
                  <Badge className="bg-destructive/20 text-destructive animate-pulse">
                    <span className="w-2 h-2 bg-destructive rounded-full mr-1" />
                    LIVE
                  </Badge>
                )}
              </div>
              
              {profile.is_creator && (
                <Badge variant="secondary">
                  <Video className="h-3 w-3 mr-1" />
                  {t.profile?.creator || "Creator"}
                </Badge>
              )}
              
              <p className="text-sm text-muted-foreground">
                {profile.follower_count} {t.userProfile?.followers || t.profile?.followers || "seguidores"}
              </p>
            </div>

            {/* Bio */}
            <p className="text-sm text-muted-foreground max-w-sm">
              {profile.bio || (t.profile?.noBio || "No description")}
            </p>

            {/* Social Links */}
            <div className="flex flex-wrap justify-center gap-2">
              {profile.youtube_handle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSocialLink("youtube", profile.youtube_handle)}
                >
                  <Youtube className="h-4 w-4 mr-1" />
                  YouTube
                </Button>
              )}
              {profile.instagram_handle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSocialLink("instagram", profile.instagram_handle)}
                >
                  <Instagram className="h-4 w-4 mr-1" />
                  Instagram
                </Button>
              )}
              {profile.tiktok_handle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSocialLink("tiktok", profile.tiktok_handle)}
                >
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                  TikTok
                </Button>
              )}
              {profile.website && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(profile.website!, "_blank")}
                >
                  <Globe className="h-4 w-4 mr-1" />
                  Website
                </Button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 w-full pt-4 items-center justify-center">
              {currentUserId && currentUserId !== profile.id && (
                <>
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    className="flex-1 max-w-[140px]"
                    onClick={handleFollow}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        {t.userProfile?.following || "Seguindo"}
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t.userProfile?.follow || t.profile?.follow || "Seguir"}
                      </>
                    )}
                  </Button>
                  
                  {/* Chat button */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full h-10 w-10"
                    onClick={() => {
                      onClose();
                      // Dispatch custom event to open global chat with this user
                      window.dispatchEvent(new CustomEvent('openChat', {
                        detail: {
                          id: profile.id,
                          name: profile.username,
                          avatar: profile.avatar_url
                        }
                      }));
                    }}
                    title={t.chat?.sendMessage || "Enviar mensagem"}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  
                  {/* Settings gear menu */}
                  <FollowSettingsMenu
                    userId={profile.id}
                    currentUserId={currentUserId}
                    isFollowing={isFollowing}
                    onUnfollow={() => {
                      setIsFollowing(false);
                      setProfile({ ...profile, follower_count: Math.max(0, profile.follower_count - 1) });
                    }}
                    onBlock={() => {
                      onClose();
                    }}
                  />
                </>
              )}
              
              {profile.is_streaming && (
                <Button
                  variant="destructive"
                  className="flex-1 max-w-[140px]"
                  onClick={handleWatchLive}
                >
                  <Video className="h-4 w-4 mr-2" />
                  {t.profile?.watchLive || "Assistir ao Vivo"}
                </Button>
              )}
              
              {/* View full profile button */}
              <Button
                variant="ghost"
                onClick={handleViewFullProfile}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {t.userProfile?.viewFullProfile || "Ver perfil completo"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {t.profile?.notFound || "Perfil não encontrado"}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PublicProfileDialog;
