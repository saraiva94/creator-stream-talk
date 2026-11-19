import { useState, useEffect, useCallback } from "react";
import { Bell, CreditCard } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";

interface NotificationBellProps {
  user: User | null;
  showPaymentNotifications?: boolean;
}

interface Notification {
  id: string;
  type: "followed_live" | "trending";
  creatorId: string;
  displayName: string;
  avatarUrl: string | null;
  viewerCount: number;
  read: boolean;
  createdAt: string;
  activeLiveId?: string; // Cache the live ID
  isLiveEnded?: boolean; // Track if live has ended
}

export const NotificationBell = ({ user, showPaymentNotifications = false }: NotificationBellProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followedCreatorIds, setFollowedCreatorIds] = useState<string[]>([]);
  const [previousTop5, setPreviousTop5] = useState<string[]>([]);
  const [activeLivesCache, setActiveLivesCache] = useState<Map<string, string>>(new Map());
  const queryClient = useQueryClient();
  const paymentQueryKey = ["mercadopago-notifications", user?.id] as const;
  const { data: paymentNotifications = [] } = useQuery({
    queryKey: paymentQueryKey,
    enabled: Boolean(user && showPaymentNotifications),
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications")
        .select("id, title, message, read")
        .eq("user_id", user!.id)
        .eq("type", "mercadopago_payment")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
  const unreadCount = notifications.filter((notification) => !notification.read).length +
    paymentNotifications.filter((notification) => !notification.read).length;

  // Fetch followed creators
  const fetchFollowedCreators = useCallback(async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("subscriptions")
      .select("creator_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (data) {
      setFollowedCreatorIds(data.map((s) => s.creator_id));
    }
  }, [user]);

  // Check for new notifications and cache active lives
  const checkNotifications = useCallback(async () => {
    if (!user) return;

    // Get live creators - first query creator_profiles
    const { data: liveCreators } = await supabase
      .from("creator_profiles")
      .select("id, display_name, viewer_count, is_streaming")
      .eq("is_streaming", true)
      .order("viewer_count", { ascending: false });

    if (!liveCreators || liveCreators.length === 0) return;

    // Fetch avatars separately to avoid ambiguous relationship error
    const creatorIds = liveCreators.map((c) => c.id);
    
    // Fetch active lives for these creators to cache
    const { data: activeLives } = await supabase
      .from("lives")
      .select("id, creator_id")
      .in("creator_id", creatorIds)
      .eq("is_active", true);

    // Build cache map: creatorId -> liveId
    const newCache = new Map<string, string>();
    activeLives?.forEach((live) => {
      newCache.set(live.creator_id, live.id);
    });
    setActiveLivesCache(newCache);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", creatorIds);

    const avatarMap = new Map(
      profilesData?.map((p) => [p.id, p.avatar_url]) || []
    );

    const newNotifications: Notification[] = [];

    // Check followed creators going live
    for (const creator of liveCreators) {
      if (followedCreatorIds.includes(creator.id)) {
        const existingNotif = notifications.find(
          (n) => n.type === "followed_live" && n.creatorId === creator.id
        );
        
        if (!existingNotif) {
          newNotifications.push({
            id: `followed_${creator.id}_${Date.now()}`,
            type: "followed_live",
            creatorId: creator.id,
            displayName: creator.display_name,
            avatarUrl: avatarMap.get(creator.id) || null,
            viewerCount: creator.viewer_count || 0,
            read: false,
            createdAt: new Date().toISOString(),
            activeLiveId: newCache.get(creator.id),
          });
        }
      }
    }

    // Check top 5 trending changes
    const top5Ids = liveCreators.slice(0, 5).map((c) => c.id);
    
    for (const creator of liveCreators.slice(0, 5)) {
      if (!previousTop5.includes(creator.id) && previousTop5.length > 0) {
        const existingNotif = notifications.find(
          (n) => n.type === "trending" && n.creatorId === creator.id
        );
        
        if (!existingNotif) {
          newNotifications.push({
            id: `trending_${creator.id}_${Date.now()}`,
            type: "trending",
            creatorId: creator.id,
            displayName: creator.display_name,
            avatarUrl: avatarMap.get(creator.id) || null,
            viewerCount: creator.viewer_count || 0,
            read: false,
            createdAt: new Date().toISOString(),
            activeLiveId: newCache.get(creator.id),
          });
        }
      }
    }

    setPreviousTop5(top5Ids);

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev].slice(0, 20));
    }
  }, [user, followedCreatorIds, notifications, previousTop5]);

  // Initial load
  useEffect(() => {
    fetchFollowedCreators();
  }, [fetchFollowedCreators]);

  // Poll for notifications
  useEffect(() => {
    if (!user) return;

    checkNotifications();
    const interval = setInterval(checkNotifications, 30000);

    return () => clearInterval(interval);
  }, [user, checkNotifications]);

  // Subscribe to realtime changes for creator_profiles and lives
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notification_bell")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "creator_profiles",
        },
        (payload) => {
          const updatedCreator = payload.new as { id: string; is_streaming: boolean };
          
          // If creator stopped streaming, mark their notifications as ended or remove
          if (updatedCreator && !updatedCreator.is_streaming) {
            setNotifications((prev) => 
              prev.filter((n) => n.creatorId !== updatedCreator.id)
            );
            // Remove from cache
            setActiveLivesCache((prev) => {
              const newCache = new Map(prev);
              newCache.delete(updatedCreator.id);
              return newCache;
            });
          } else {
            checkNotifications();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lives",
        },
        (payload) => {
          const updatedLive = payload.new as { id: string; creator_id: string; is_active: boolean };
          
          // If live ended, remove notification for that creator
          if (updatedLive && !updatedLive.is_active) {
            setNotifications((prev) => 
              prev.filter((n) => n.creatorId !== updatedLive.creator_id)
            );
            // Remove from cache
            setActiveLivesCache((prev) => {
              const newCache = new Map(prev);
              newCache.delete(updatedLive.creator_id);
              return newCache;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, checkNotifications]);

  const markPaymentsAsRead = async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    const { error } = await supabase.from("notifications").update({ read: true })
      .eq("user_id", user.id).eq("type", "mercadopago_payment").in("id", ids);
    if (!error) await queryClient.invalidateQueries({ queryKey: paymentQueryKey });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void markPaymentsAsRead(paymentNotifications.filter((notification) => !notification.read).map(({ id }) => id));
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    
    // Use cached live ID if available
    if (notification.activeLiveId) {
      navigate(`/live/${notification.activeLiveId}`);
      return;
    }

    // Check cache first
    const cachedLiveId = activeLivesCache.get(notification.creatorId);
    if (cachedLiveId) {
      navigate(`/live/${cachedLiveId}`);
      return;
    }

    // Fallback: fetch from database
    const { data: activeLive } = await supabase
      .from("lives")
      .select("id")
      .eq("creator_id", notification.creatorId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (activeLive) {
      navigate(`/live/${activeLive.id}`);
    } else {
      // Show toast and navigate to profile
      toast({
        title: t.notifications?.liveEnded || "Live encerrada",
        description: t.notifications?.liveEndedDesc || "Esta transmissão já foi encerrada.",
        variant: "destructive",
      });
      navigate(`/profile/${notification.creatorId}`);
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t.notifications?.title || "Notificações"}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={markAllAsRead}
            >
              {t.notifications?.markAllRead || "Marcar todas como lidas"}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {paymentNotifications.map((notification) => (
          <DropdownMenuItem key={notification.id}
            className={`flex items-start gap-2 p-2 ${notification.read ? "" : "bg-primary/5"}`}
            onSelect={() => {
              if (!notification.read) void markPaymentsAsRead([notification.id]);
              navigate("/admin");
            }}>
            <CreditCard className="mt-1 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{notification.title}</p>
              <p className="text-xs text-muted-foreground">{notification.message}</p>
            </div>
          </DropdownMenuItem>
        ))}
        {paymentNotifications.length > 0 && notifications.length > 0 && <DropdownMenuSeparator />}
        {notifications.length === 0 && paymentNotifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t.notifications?.noNotifications || "Nenhuma notificação"}
          </div>
        ) : (
          notifications.slice(0, 10).map((notification) => {
            // Check if live is still active
            const isStillLive = notification.activeLiveId 
              ? activeLivesCache.has(notification.creatorId) || notification.activeLiveId
              : activeLivesCache.has(notification.creatorId);
            
            return (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-center gap-3 p-3 cursor-pointer ${
                  !notification.read ? "bg-primary/5" : ""
                } ${notification.isLiveEnded || !isStillLive ? "opacity-50" : ""}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="relative">
                  <Avatar className={`h-10 w-10 ${notification.isLiveEnded ? "grayscale" : ""}`}>
                    <AvatarImage src={notification.avatarUrl || undefined} />
                    <AvatarFallback>
                      {notification.displayName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {notification.isLiveEnded && (
                    <span className="absolute -bottom-1 -right-1 text-[10px] bg-destructive text-destructive-foreground px-1 rounded">
                      {t.notifications?.ended || "OFF"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${notification.isLiveEnded ? "text-muted-foreground" : ""}`}>
                    {notification.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.isLiveEnded 
                      ? t.notifications?.liveEnded || "Live encerrada"
                      : notification.type === "followed_live"
                        ? t.notifications?.isLive || "Está ao vivo agora!"
                        : `${t.notifications?.enteredTop5 || "Entrou no Top 5"} • ${notification.viewerCount} ${t.notifications?.viewers || "espectadores"}`
                    }
                  </p>
                </div>
                {!notification.read && !notification.isLiveEnded && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
