import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsMobile } from "@/hooks/use-mobile";

interface Channel {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  viewer_count: number;
  is_streaming: boolean;
  tags?: string[];
}

interface FollowedChannel extends Channel {
  is_followed: boolean;
}

const ITEMS_PER_PAGE = 5;
const PLACEHOLDER_COUNT = 5;

export const ChannelsSidebar = () => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(true);
  const [followedChannels, setFollowedChannels] = useState<FollowedChannel[]>([]);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followedVisible, setFollowedVisible] = useState(ITEMS_PER_PAGE);
  const [liveVisible, setLiveVisible] = useState(ITEMS_PER_PAGE);

  // Force collapsed on mobile
  const effectiveExpanded = isMobile ? false : isExpanded;

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchChannels = async () => {
      // Fetch live channels (sorted by viewer count)
      const { data: liveData } = await supabase
        .from("creator_profiles")
        .select(`
          id,
          display_name,
          viewer_count,
          is_streaming,
          tags
        `)
        .eq("is_streaming", true)
        .order("viewer_count", { ascending: false })
        .limit(50);

      // Fetch avatars and usernames separately to avoid ambiguous relationship
      if (liveData && liveData.length > 0) {
        const ids = liveData.map((c: any) => c.id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, avatar_url, username")
          .in("id", ids);
        
        const profileMap = new Map(profilesData?.map((p: any) => [p.id, { avatar_url: p.avatar_url, username: p.username }]) || []);
        
        setLiveChannels(
          liveData.map((c: any) => ({
            id: c.id,
            display_name: c.display_name,
            username: profileMap.get(c.id)?.username || c.display_name,
            avatar_url: profileMap.get(c.id)?.avatar_url || null,
            viewer_count: c.viewer_count || 0,
            is_streaming: c.is_streaming || false,
            tags: c.tags || [],
          }))
        );
      } else {
        setLiveChannels([]);
      }

      // Fetch followed channels if user is logged in
      if (currentUserId) {
        const { data: followedData } = await supabase
          .from("subscriptions")
          .select(`
            creator_id,
            creator_profiles:creator_id (
              id,
              display_name,
              viewer_count,
              is_streaming,
              tags
            )
          `)
          .eq("user_id", currentUserId)
          .eq("status", "active");

        if (followedData && followedData.length > 0) {
          // Batch fetch all profiles at once instead of N+1 queries
          const creatorIds = followedData
            .map((sub) => (sub.creator_profiles as any)?.id)
            .filter(Boolean);
          
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, avatar_url, username")
            .in("id", creatorIds);
          
          const profileMap = new Map(
            profilesData?.map((p: any) => [p.id, { avatar_url: p.avatar_url, username: p.username }]) || []
          );

          const followed: FollowedChannel[] = followedData
            .map((sub) => {
              const creator = sub.creator_profiles as any;
              if (!creator) return null;
              const profile = profileMap.get(creator.id);
              return {
                id: creator.id,
                display_name: creator.display_name,
                username: profile?.username || creator.display_name,
                avatar_url: profile?.avatar_url || null,
                viewer_count: creator.viewer_count || 0,
                is_streaming: creator.is_streaming || false,
                is_followed: true,
                tags: creator.tags,
              } as FollowedChannel;
            })
            .filter((c): c is FollowedChannel => c !== null);

          // Sort: online first, then by viewer count
          followed.sort((a, b) => {
            if (a.is_streaming && !b.is_streaming) return -1;
            if (!a.is_streaming && b.is_streaming) return 1;
            return b.viewer_count - a.viewer_count;
          });
          setFollowedChannels(followed);
        } else {
          setFollowedChannels([]);
        }
      }
    };

    fetchChannels();

    // Subscribe to realtime updates for creator_profiles
    const channel = supabase
      .channel("sidebar-channels")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creator_profiles" },
        () => fetchChannels()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const formatViewerCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(".0", "")} mil`;
    }
    return count.toString();
  };

  const ChannelItem = ({ channel, showName }: { channel: Channel; showName: boolean }) => (
    <div className={`flex items-center gap-3 py-1.5 hover:bg-accent/50 rounded-md transition-colors group ${showName ? 'px-2' : 'px-1 justify-center'}`}>
      {/* Avatar links to profile */}
      <Link
        to={`/u/${channel.username}`}
        className="relative flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Avatar className="h-8 w-8 hover:ring-2 hover:ring-primary transition-all">
          <AvatarImage src={channel.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {channel.display_name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {channel.is_streaming && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-background" />
        )}
      </Link>
      {showName && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            {/* Name links to profile, but clicking row goes to room */}
            <Link 
              to={`/u/${channel.username}`}
              className="text-sm font-medium truncate hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {channel.display_name}
            </Link>
            {channel.is_streaming ? (
              <Link to={`/room/${channel.id}`} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {formatViewerCount(channel.viewer_count)}
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">Offline</span>
            )}
          </div>
          {channel.tags && channel.tags.length > 0 && (
            <span className="text-xs text-muted-foreground truncate block">
              {channel.tags[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );

  // Placeholder slot for empty state
  const PlaceholderSlot = ({ showName, index }: { showName: boolean; index: number }) => (
    <div 
      className={`flex items-center gap-3 py-1.5 rounded-md opacity-30 blur-[0.5px] ${showName ? 'px-2' : 'px-1 justify-center'}`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="relative flex-shrink-0">
        <div className="h-8 w-8 rounded-full bg-muted/50" />
      </div>
      {showName && (
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 bg-muted/50 rounded" />
            <div className="h-3 w-8 bg-muted/50 rounded" />
          </div>
          <div className="h-2.5 w-16 bg-muted/30 rounded" />
        </div>
      )}
    </div>
  );

  const visibleFollowed = followedChannels.slice(0, followedVisible);
  const visibleLive = liveChannels.slice(0, liveVisible);
  const hasMoreFollowed = followedChannels.length > followedVisible;
  const hasMoreLive = liveChannels.length > liveVisible;

  const showMoreFollowed = () => {
    setFollowedVisible(prev => prev + ITEMS_PER_PAGE);
  };

  const showMoreLive = () => {
    setLiveVisible(prev => prev + ITEMS_PER_PAGE);
  };

  // Generate placeholders when there's no content
  const followedPlaceholders = followedChannels.length === 0 ? Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => i) : [];
  const livePlaceholders = liveChannels.length === 0 ? Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => i) : [];

  return (
    <aside
      className={`fixed left-0 top-[57px] h-[calc(100vh-57px)] bg-card/95 backdrop-blur-sm border-r border-border z-40 transition-all duration-300 ${
        effectiveExpanded ? "w-60" : "w-14"
      }`}
    >
      {/* Toggle Button - hidden on mobile */}
      {!isMobile && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -right-3 top-4 bg-card border border-border rounded-full p-1 hover:bg-accent transition-colors z-50"
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      )}

      <div className="h-full flex flex-col py-4">
        {/* Followed Channels Section - Top Half */}
        <div className="flex-1 min-h-0 flex flex-col border-b border-border/50 pb-3 mb-3">
          {effectiveExpanded && (
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t.sidebar.followedChannels}
              </h3>
              <span className="text-[10px] text-muted-foreground/60">↕</span>
            </div>
          )}
          
          <div className={`flex-1 overflow-y-auto scrollbar-none space-y-0.5 ${effectiveExpanded ? 'px-2' : 'px-1'}`}>
            {/* Real followed channels */}
            {visibleFollowed.map((channel) => (
              <ChannelItem key={channel.id} channel={channel} showName={effectiveExpanded} />
            ))}
            
            {/* Placeholder slots when empty */}
            {followedPlaceholders.map((index) => (
              <PlaceholderSlot key={`followed-placeholder-${index}`} showName={effectiveExpanded} index={index} />
            ))}
            
            {/* Show more button */}
            {hasMoreFollowed && effectiveExpanded && (
              <button
                onClick={showMoreFollowed}
                className="w-full text-xs text-primary hover:text-primary/80 py-2 flex items-center justify-center gap-1 transition-colors"
              >
                Mostrar mais
                <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Live Channels Section - Bottom Half */}
        <div className="flex-1 min-h-0 flex flex-col">
          {effectiveExpanded && (
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t.sidebar.liveChannels}
              </h3>
              <span className="text-[10px] text-red-500">●</span>
            </div>
          )}
          
          <div className={`flex-1 overflow-y-auto scrollbar-none space-y-0.5 ${effectiveExpanded ? 'px-2' : 'px-1'}`}>
            {/* Real live channels */}
            {visibleLive.map((channel) => (
              <ChannelItem key={channel.id} channel={channel} showName={effectiveExpanded} />
            ))}
            
            {/* Placeholder slots when empty */}
            {livePlaceholders.map((index) => (
              <PlaceholderSlot key={`live-placeholder-${index}`} showName={effectiveExpanded} index={index} />
            ))}
            
            {/* Show more button */}
            {hasMoreLive && effectiveExpanded && (
              <button
                onClick={showMoreLive}
                className="w-full text-xs text-primary hover:text-primary/80 py-2 flex items-center justify-center gap-1 transition-colors"
              >
                Mostrar mais
                <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
