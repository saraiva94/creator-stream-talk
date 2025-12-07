import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
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
import type { User } from "@supabase/supabase-js";

interface NotificationBellProps {
  user: User | null;
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
}

export const NotificationBell = ({ user }: NotificationBellProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [followedCreatorIds, setFollowedCreatorIds] = useState<string[]>([]);
  const [previousTop5, setPreviousTop5] = useState<string[]>([]);

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

  // Check for new notifications
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

  // Subscribe to realtime changes
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
        () => {
          checkNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, checkNotifications]);

  // Update unread count
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length);
  }, [notifications]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    
    // Navigate to creator's stream
    navigate(`/live/${notification.creatorId}`);
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
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t.notifications?.noNotifications || "Nenhuma notificação"}
          </div>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex items-center gap-3 p-3 cursor-pointer ${
                !notification.read ? "bg-primary/5" : ""
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={notification.avatarUrl || undefined} />
                <AvatarFallback>
                  {notification.displayName?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {notification.displayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {notification.type === "followed_live"
                    ? t.notifications?.isLive || "Está ao vivo agora!"
                    : `${t.notifications?.enteredTop5 || "Entrou no Top 5"} • ${notification.viewerCount} ${t.notifications?.viewers || "espectadores"}`}
                </p>
              </div>
              {!notification.read && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
