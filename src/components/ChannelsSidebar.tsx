import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";

interface Channel {
  id: string;
  display_name: string;
  avatar_url: string | null;
  viewer_count: number;
  is_streaming: boolean;
  tags?: string[];
}

interface FollowedChannel extends Channel {
  is_followed: boolean;
}

export const ChannelsSidebar = () => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);
  const [followedChannels, setFollowedChannels] = useState<FollowedChannel[]>([]);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
        .limit(10);

      // Fetch avatars separately to avoid ambiguous relationship
      if (liveData && liveData.length > 0) {
        const ids = liveData.map((c: any) => c.id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", ids);
        
        const avatarMap = new Map(profilesData?.map((p: any) => [p.id, p.avatar_url]) || []);
        
        setLiveChannels(
          liveData.map((c: any) => ({
            id: c.id,
            display_name: c.display_name,
            avatar_url: avatarMap.get(c.id) || null,
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

        if (followedData) {
          const followed: FollowedChannel[] = [];
          for (const sub of followedData) {
            const creator = sub.creator_profiles as any;
            if (creator) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("avatar_url")
                .eq("id", creator.id)
                .single();

              followed.push({
                id: creator.id,
                display_name: creator.display_name,
                avatar_url: profile?.avatar_url || null,
                viewer_count: creator.viewer_count || 0,
                is_streaming: creator.is_streaming || false,
                is_followed: true,
                tags: creator.tags || [],
              });
            }
          }
          // Sort: online first, then by viewer count
          followed.sort((a, b) => {
            if (a.is_streaming && !b.is_streaming) return -1;
            if (!a.is_streaming && b.is_streaming) return 1;
            return b.viewer_count - a.viewer_count;
          });
          setFollowedChannels(followed);
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
    <Link
      to={`/room/${channel.id}`}
      className="flex items-center gap-3 px-2 py-1.5 hover:bg-accent/50 rounded-md transition-colors group"
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={channel.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {channel.display_name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {channel.is_streaming && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-background" />
        )}
      </div>
      {showName && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{channel.display_name}</span>
            {channel.is_streaming && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {formatViewerCount(channel.viewer_count)}
              </span>
            )}
          </div>
          {channel.tags && channel.tags.length > 0 && (
            <span className="text-xs text-muted-foreground truncate block">
              {channel.tags[0]}
            </span>
          )}
        </div>
      )}
    </Link>
  );

  return (
    <aside
      className={`fixed left-0 top-[57px] h-[calc(100vh-57px)] bg-card/95 backdrop-blur-sm border-r border-border z-40 transition-all duration-300 ${
        isExpanded ? "w-60" : "w-14"
      }`}
    >
      {/* Toggle Button */}
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

      <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent py-4">
        {/* Followed Channels Section */}
        {currentUserId && followedChannels.length > 0 && (
          <div className="mb-6">
            {isExpanded && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t.sidebar.followedChannels}
              </h3>
            )}
            <div className="space-y-0.5 px-2">
              {followedChannels.map((channel) => (
                <ChannelItem key={channel.id} channel={channel} showName={isExpanded} />
              ))}
            </div>
          </div>
        )}

        {/* Live Channels Section */}
        {liveChannels.length > 0 && (
          <div>
            {isExpanded && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t.sidebar.liveChannels}
              </h3>
            )}
            <div className="space-y-0.5 px-2">
              {liveChannels.map((channel) => (
                <ChannelItem key={channel.id} channel={channel} showName={isExpanded} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {liveChannels.length === 0 && followedChannels.length === 0 && isExpanded && (
          <div className="px-3 py-8 text-center text-muted-foreground text-sm">
            {t.sidebar.noChannels}
          </div>
        )}
      </div>
    </aside>
  );
};
