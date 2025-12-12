import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebarContext } from "@/contexts/SidebarContext";

interface Channel {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  viewer_count: number;
  is_streaming: boolean;
  tags?: string[];
  activeLiveId?: string | null;
}

interface FollowedChannel extends Channel {
  is_followed: boolean;
}

const ITEMS_PER_PAGE = 5;
const PLACEHOLDER_COUNT = 5;

export const ChannelsSidebar = () => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { isExpanded, toggleExpanded, isVisible, toggleVisible } = useSidebarContext();
  const [followedChannels, setFollowedChannels] = useState<FollowedChannel[]>([]);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followedVisible, setFollowedVisible] = useState(ITEMS_PER_PAGE);
  const [liveVisible, setLiveVisible] = useState(ITEMS_PER_PAGE);

  // Force collapsed on mobile, and handle visibility
  const effectiveExpanded = isMobile ? false : isExpanded;
  const effectiveVisible = isMobile ? isVisible : true;

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchChannels = async () => {
      // Fetch active lives first (source of truth for online status)
      const { data: activeLivesData } = await supabase
        .from("lives")
        .select("id, creator_id, title")
        .eq("is_active", true)
        .eq("status", "live");

      // Get creator IDs from active lives
      const activeCreatorIds = activeLivesData?.map((l: any) => l.creator_id) || [];
      
      // Fetch creator profiles for those with active lives
      let liveChannelsData: Channel[] = [];
      
      if (activeCreatorIds.length > 0) {
        const { data: creatorData } = await supabase
          .from("creator_profiles")
          .select("id, display_name, viewer_count, is_streaming, tags")
          .in("id", activeCreatorIds)
          .order("viewer_count", { ascending: false });

        if (creatorData && creatorData.length > 0) {
          const ids = creatorData.map((c: any) => c.id);
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, avatar_url, username")
            .in("id", ids);

          const profileMap = new Map(profilesData?.map((p: any) => [p.id, { avatar_url: p.avatar_url, username: p.username }]) || []);
          const liveMap = new Map(activeLivesData?.map((l: any) => [l.creator_id, l.id]) || []);
          
          liveChannelsData = creatorData.map((c: any) => ({
            id: c.id,
            display_name: c.display_name,
            username: profileMap.get(c.id)?.username || c.display_name,
            avatar_url: profileMap.get(c.id)?.avatar_url || null,
            viewer_count: c.viewer_count || 0,
            is_streaming: true, // Force true since they have active live
            tags: c.tags || [],
            activeLiveId: liveMap.get(c.id) || null,
          }));
        }
      }
      
      setLiveChannels(liveChannelsData);

      // Fetch followed channels if user is logged in - OPTIMIZED: single batch query
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
            .filter((sub: any) => sub.creator_profiles)
            .map((sub: any) => (sub.creator_profiles as any).id);
          
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, avatar_url, username")
            .in("id", creatorIds);

          // Fetch active lives for followed creators
          const { data: followedLivesData } = await supabase
            .from("lives")
            .select("id, creator_id")
            .in("creator_id", creatorIds)
            .eq("is_active", true);
          
          const profileMap = new Map(
            profilesData?.map((p: any) => [p.id, { avatar_url: p.avatar_url, username: p.username }]) || []
          );
          const followedLiveMap = new Map(followedLivesData?.map((l: any) => [l.creator_id, l.id]) || []);

          const followed: FollowedChannel[] = followedData
            .filter((sub: any) => sub.creator_profiles)
            .map((sub: any) => {
              const creator = sub.creator_profiles as any;
              const profile = profileMap.get(creator.id);
              const hasActiveLive = followedLiveMap.has(creator.id);
              return {
                id: creator.id,
                display_name: creator.display_name,
                username: profile?.username || creator.display_name,
                avatar_url: profile?.avatar_url || null,
                viewer_count: creator.viewer_count || 0,
                is_streaming: hasActiveLive, // Use active live as source of truth
                is_followed: true,
                tags: creator.tags || [],
                activeLiveId: followedLiveMap.get(creator.id) || null,
              };
            });

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

    // Subscribe to realtime updates for creator_profiles and lives
    const channel = supabase
      .channel("sidebar-channels")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creator_profiles" },
        () => fetchChannels()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives" },
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

  const ChannelItem = ({ channel, showName }: { channel: Channel; showName: boolean }) => {
    // Determine link destination: if streaming and has active live, go to live page
    const liveLink = channel.is_streaming && channel.activeLiveId 
      ? `/live/${channel.activeLiveId}` 
      : `/room/${channel.id}`;
    
    return (
      <div className={`flex items-center gap-3 py-1.5 hover:bg-accent/50 rounded-md transition-colors group ${showName ? 'px-2' : 'px-1 justify-center'}`}>
        {/* Avatar links to live if streaming, otherwise to profile */}
        <Link
          to={channel.is_streaming && channel.activeLiveId ? liveLink : `/u/${channel.username}`}
          className="relative flex-shrink-0"
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
              {/* Name links to profile */}
              <Link 
                to={`/u/${channel.username}`}
                className="text-sm font-medium truncate hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {channel.display_name}
              </Link>
              {channel.is_streaming && channel.activeLiveId ? (
                <Link to={liveLink} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  {formatViewerCount(channel.viewer_count)}
                </Link>
              ) : channel.is_streaming ? (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  {formatViewerCount(channel.viewer_count)}
                </span>
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
  };

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
    <>
      {/* Mobile Toggle Button - Always visible when sidebar is hidden */}
      {isMobile && !effectiveVisible && (
        <button
          onClick={toggleVisible}
          className="fixed left-0 top-[120px] bg-card/90 border border-border border-l-0 rounded-r-lg p-1.5 hover:bg-accent transition-all duration-300 z-50"
          aria-label="Abrir barra lateral"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      <aside
        className={`fixed left-0 top-[57px] h-[calc(100vh-57px)] bg-card/95 backdrop-blur-sm border-r border-border z-40 transition-all duration-300 ease-in-out ${
          effectiveVisible 
            ? (effectiveExpanded ? "w-60 translate-x-0" : "w-14 translate-x-0") 
            : "w-14 -translate-x-full"
        }`}
      >
        {/* Desktop Toggle Button */}
        {!isMobile && (
          <button
            onClick={toggleExpanded}
            className="absolute -right-3 top-4 bg-card border border-border rounded-full p-1 hover:bg-accent transition-colors z-50"
          >
            {effectiveExpanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Mobile Hide Button - Visible at top of sidebar when expanded */}
        {isMobile && effectiveVisible && (
          <button
            onClick={toggleVisible}
            className="absolute -right-3 top-4 bg-card border border-border rounded-full p-1.5 hover:bg-accent transition-colors z-50"
            aria-label="Ocultar barra lateral"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
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
    </>
  );
};
