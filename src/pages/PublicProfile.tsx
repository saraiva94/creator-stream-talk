import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Instagram, Youtube, Facebook, Globe, Users, UserPlus, UserCheck, Radio, MessageCircle } from "lucide-react";
import { FollowSettingsMenu } from "@/components/FollowSettingsMenu";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// TikTok icon SVG component
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Kwai icon SVG component
const KwaiIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-3l6-5-6-5v10z"/>
  </svg>
);

type PublicProfileData = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  youtube_handle: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  facebook_handle: string | null;
  kwai_handle: string | null;
  website: string | null;
};

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<PublicProfileData | null>(null);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, username, avatar_url, bio, youtube_handle, instagram_handle, tiktok_handle, facebook_handle, kwai_handle, website")
        .ilike("username", username)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      
      setProfileData(data as PublicProfileData);
      
      // Fetch follower count from user_follows
      const { count } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", data.id);
      
      setFollowerCount(count || 0);

      // Check if this user is a creator and if they're live
      const { data: creatorData } = await supabase
        .from("creator_profiles")
        .select("is_streaming")
        .eq("id", data.id)
        .single();
      
      if (creatorData) {
        setIsLive(creatorData.is_streaming || false);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [username]);

  // Check if current user is following this profile
  useEffect(() => {
    const checkFollowing = async () => {
      if (!user || !profileData) return;
      
      // Don't allow following yourself
      if (user.id === profileData.id) return;

      const { data } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profileData.id)
        .maybeSingle();
      
      setIsFollowing(!!data);
    };

    checkFollowing();
  }, [user, profileData]);

  const handleFollow = async () => {
    if (!user) {
      toast.error(t.common?.loginRequired || "Faça login para seguir");
      return;
    }

    if (!profileData) return;

    setFollowLoading(true);

    try {
      if (isFollowing) {
        // Unfollow - delete from user_follows
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profileData.id);

        if (error) throw error;
        
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        toast.success(t.profile?.unfollowed || "Deixou de seguir");
      } else {
        // Follow - insert into user_follows
        const { error } = await supabase
          .from("user_follows")
          .insert({
            follower_id: user.id,
            following_id: profileData.id,
          });

        if (error) throw error;
        
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        toast.success(t.profile?.followed || "Seguindo!");
      }
    } catch (error) {
      console.error("Follow error:", error);
      toast.error(t.common?.error || "Erro ao processar");
    } finally {
      setFollowLoading(false);
    }
  };

  const socialLinks = profileData ? [
    { 
      key: 'youtube', 
      value: profileData.youtube_handle, 
      icon: Youtube, 
      color: 'text-red-500',
      label: 'YouTube',
      url: profileData.youtube_handle?.startsWith('http') 
        ? profileData.youtube_handle 
        : `https://youtube.com/${profileData.youtube_handle?.replace('@', '')}`
    },
    { 
      key: 'instagram', 
      value: profileData.instagram_handle, 
      icon: Instagram, 
      color: 'text-pink-500',
      label: 'Instagram',
      url: `https://instagram.com/${profileData.instagram_handle?.replace('@', '')}`
    },
    { 
      key: 'tiktok', 
      value: profileData.tiktok_handle, 
      icon: TikTokIcon, 
      color: 'text-foreground',
      label: 'TikTok',
      url: `https://tiktok.com/${profileData.tiktok_handle?.replace('@', '')}`
    },
    { 
      key: 'facebook', 
      value: profileData.facebook_handle, 
      icon: Facebook, 
      color: 'text-blue-600',
      label: 'Facebook',
      url: `https://facebook.com/${profileData.facebook_handle}`
    },
    { 
      key: 'kwai', 
      value: profileData.kwai_handle, 
      icon: KwaiIcon, 
      color: 'text-orange-500',
      label: 'Kwai',
      url: `https://kwai.com/${profileData.kwai_handle?.replace('@', '')}`
    },
    { 
      key: 'website', 
      value: profileData.website, 
      icon: Globe, 
      color: 'text-primary',
      label: 'Site',
      url: profileData.website?.startsWith('http') ? profileData.website : `https://${profileData.website}`
    },
  ].filter(link => link.value) : [];

  if (loading) {
    return (
      <AppLayout showSidebar={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            {t.common.loading}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (notFound) {
    return (
      <AppLayout showSidebar={false}>
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                {t.profile?.notFound || "Perfil não encontrado"}
              </h2>
              <p className="text-muted-foreground">
                {t.profile?.notFoundDesc || "O usuário que você procura não existe."}
              </p>
            </CardContent>
          </Card>
        </main>
      </AppLayout>
    );
  }

  const isOwnProfile = user?.id === profileData?.id;

  return (
    <AppLayout showSidebar={false}>
      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl">
        <Card className="border-border shadow-card">
          <CardHeader className="p-4 sm:p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              {/* Avatar with live indicator */}
              <div className="relative">
                <Avatar className={`w-24 h-24 sm:w-32 sm:h-32 border-2 ${isLive ? 'border-destructive' : 'border-primary'}`}>
                  <AvatarImage src={profileData?.avatar_url || undefined} alt={profileData?.username} />
                  <AvatarFallback className="bg-muted">
                    <User className="w-12 h-12 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                {/* Live badge */}
                {isLive && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 animate-pulse"
                  >
                    <Radio className="h-3 w-3" />
                    <span className="text-xs font-bold">LIVE</span>
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <CardTitle className="text-2xl sm:text-3xl">
                  {profileData?.username}
                </CardTitle>
                
                {/* Follower count */}
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {followerCount} {followerCount === 1 ? (t.profile?.follower || "seguidor") : (t.profile?.followers || "seguidores")}
                  </span>
                </div>

                {/* Follow button, Chat button, and Live link */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  {!isOwnProfile && user && (
                    <>
                      <Button
                        onClick={handleFollow}
                        disabled={followLoading}
                        variant={isFollowing ? "outline" : "default"}
                        size="sm"
                        className="gap-2"
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="h-4 w-4" />
                            {t.userProfile?.following || "Seguindo"}
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            {t.userProfile?.follow || t.profile?.follow || "Seguir"}
                          </>
                        )}
                      </Button>
                      
                      {/* Chat button */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full h-9 w-9"
                        onClick={() => {
                          // Dispatch custom event to open global chat with this user
                          window.dispatchEvent(new CustomEvent('openChat', {
                            detail: {
                              id: profileData?.id,
                              name: profileData?.username,
                              avatar: profileData?.avatar_url
                            }
                          }));
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      
                      {/* Settings gear menu */}
                      <FollowSettingsMenu
                        userId={profileData?.id || ""}
                        currentUserId={user.id}
                        isFollowing={isFollowing}
                        onUnfollow={() => {
                          setIsFollowing(false);
                          setFollowerCount(prev => Math.max(0, prev - 1));
                        }}
                        onBlock={() => {
                          toast.success(t.userProfile?.block || "Usuário bloqueado");
                        }}
                      />
                    </>
                  )}
                  
                  {/* Watch Live button when streaming */}
                  {isLive && (
                    <Button asChild variant="destructive" size="sm" className="gap-2">
                      <Link to={`/live/${profileData?.id}`}>
                        <Radio className="h-4 w-4" />
                        {t.profile?.watchLive || "Assistir ao vivo"}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
            {/* Bio */}
            {profileData?.bio && (
              <div className="text-center">
                <p className="text-muted-foreground">{profileData.bio}</p>
              </div>
            )}

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground text-center">
                  {t.profile?.socialMedia || "Redes Sociais"}
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {socialLinks.map((link) => {
                    const IconComponent = link.icon;
                    return (
                      <a
                        key={link.key}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      >
                        <IconComponent className={`h-5 w-5 ${link.color}`} />
                        <span className="text-sm font-medium">{link.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!profileData?.bio && socialLinks.length === 0 && (
              <p className="text-center text-muted-foreground">
                {t.profile?.noInfo || "Este usuário ainda não adicionou informações ao perfil."}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
};

export default PublicProfile;
