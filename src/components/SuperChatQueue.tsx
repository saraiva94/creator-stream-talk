import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuperChatItem {
  id: string;
  message: string;
  tier: "blue" | "yellow" | "red";
  duration_seconds: number;
  amount: number;
  status: string;
  created_at: string;
  user_id: string;
  username?: string;
}

interface SuperChatQueueProps {
  roomId: string;
  creatorId: string;
  onSelectSuperchat: (superchat: SuperChatItem) => void;
}

const tierColors = {
  blue: "bg-blue-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

const tierPriority = { red: 3, yellow: 2, blue: 1 };

const SuperChatQueue = ({ roomId, creatorId, onSelectSuperchat }: SuperChatQueueProps) => {
  const [queue, setQueue] = useState<SuperChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[SuperChatQueue] Fetching queue for roomId:', roomId);
    
    const fetchQueue = async () => {
      const { data, error } = await supabase
        .from("superchats")
        .select("*")
        .eq("room_id", roomId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      console.log('[SuperChatQueue] Query result:', { data, error, roomId });

      if (error) {
        console.error("Error fetching superchat queue:", error);
        return;
      }

      // Fetch usernames separately
      const userIds = [...new Set((data || []).map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

      const formattedData = (data || []).map((item) => ({
        id: item.id,
        message: item.message,
        tier: item.tier as "blue" | "yellow" | "red",
        duration_seconds: item.duration_seconds,
        amount: item.amount,
        status: item.status,
        created_at: item.created_at,
        user_id: item.user_id,
        username: profileMap.get(item.user_id) || "Usuário",
      }));

      // Sort by tier priority (red > yellow > blue), then by creation time
      formattedData.sort((a, b) => {
        const priorityDiff = tierPriority[b.tier] - tierPriority[a.tier];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setQueue(formattedData);
      setLoading(false);
    };

    fetchQueue();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`superchats:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "superchats",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleSelectSuperchat = async (superchat: SuperChatItem) => {
    const expiresAt = new Date(Date.now() + superchat.duration_seconds * 1000).toISOString();
    
    await supabase
      .from("superchats")
      .update({ 
        status: "displaying",
        displayed_at: new Date().toISOString(),
        expires_at: expiresAt
      })
      .eq("id", superchat.id);

    onSelectSuperchat({ ...superchat, expires_at: expiresAt } as SuperChatItem & { expires_at: string });
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground text-sm">Carregando fila...</div>;
  }

  if (queue.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Nenhum SuperChat na fila
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-3 border-b border-border">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Fila de SuperChats ({queue.length})
        </h4>
      </div>
      <ScrollArea className="max-h-48">
        <div className="p-2 space-y-2">
          {queue.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-2 rounded-lg border flex items-center gap-2",
                "bg-background/50"
              )}
            >
              <Badge className={cn("shrink-0", tierColors[item.tier])}>
                R${Math.floor(item.amount / 100)}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.username}</p>
                <p className="text-xs text-muted-foreground truncate">{item.message}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSelectSuperchat(item)}
                className="shrink-0"
              >
                <Play className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SuperChatQueue;
