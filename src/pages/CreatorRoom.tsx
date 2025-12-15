import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";

interface CreatorInfo {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_streaming: boolean;
}

interface LiveInfo {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  price: number | null;
}

const CreatorRoom: React.FC = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [activeLive, setActiveLive] = useState<LiveInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreatorAndLive = async () => {
      if (!creatorId) {
        setError("Creator ID not provided");
        setLoading(false);
        return;
      }

      try {
        // Fetch creator profile
        const { data: creatorProfile, error: creatorError } = await supabase
          .from("creator_profiles")
          .select("id, display_name, bio")
          .eq("id", creatorId)
          .maybeSingle();

        if (creatorError) throw creatorError;

        if (!creatorProfile) {
          setError("Creator not found");
          setLoading(false);
          return;
        }

        // Fetch profile for avatar
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", creatorId)
          .maybeSingle();

        setCreator({
          id: creatorProfile.id,
          display_name: creatorProfile.display_name,
          bio: creatorProfile.bio,
          avatar_url: profile?.avatar_url ?? null,
          is_streaming: false,
        });

        // Fetch active live
        const { data: live, error: liveError } = await supabase
          .from("lives")
          .select("id, title, description, status, price")
          .eq("creator_id", creatorId)
          .in("status", ["live", "waiting_for_host"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (liveError) throw liveError;

        if (live) {
          setActiveLive(live);
          setCreator(prev => prev ? { ...prev, is_streaming: live.status === "live" } : null);
        }
      } catch (err) {
        console.error("[CreatorRoom] Error fetching data:", err);
        setError("Failed to load creator information");
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorAndLive();
  }, [creatorId]);

  // Subscribe to live updates
  useEffect(() => {
    if (!creatorId) return;

    const channel = supabase
      .channel(`creator-room-${creatorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lives",
          filter: `creator_id=eq.${creatorId}`,
        },
        (payload) => {
          const newLive = payload.new as LiveInfo & { status: string };
          if (newLive && ["live", "waiting_for_host"].includes(newLive.status)) {
            setActiveLive(newLive);
            setCreator(prev => prev ? { ...prev, is_streaming: newLive.status === "live" } : null);
          } else if (payload.eventType === "UPDATE" && newLive?.status === "ended") {
            setActiveLive(null);
            setCreator(prev => prev ? { ...prev, is_streaming: false } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorId]);

  const { user, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user ?? null} isAdmin={isAdmin} />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user ?? null} isAdmin={isAdmin} />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-destructive">
                {error || "Creator not found"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The creator you're looking for could not be found.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusBadge = creator.is_streaming ? (
    <Badge variant="destructive" className="animate-pulse">
      🔴 Live
    </Badge>
  ) : activeLive ? (
    <Badge variant="secondary">Waiting</Badge>
  ) : (
    <Badge variant="outline">Offline</Badge>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user ?? null} isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        {/* Creator Info Header */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={creator.avatar_url ?? undefined} alt={creator.display_name} />
              <AvatarFallback className="text-lg">
                {creator.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{creator.display_name}</CardTitle>
                {statusBadge}
              </div>
              {creator.bio && (
                <p className="text-sm text-muted-foreground mt-1">{creator.bio}</p>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Live Content or Offline Message */}
        {activeLive ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{activeLive.title || "Live Stream"}</CardTitle>
              {activeLive.description && (
                <p className="text-sm text-muted-foreground">{activeLive.description}</p>
              )}
              {activeLive.price != null && activeLive.price > 0 && (
                <p className="text-sm text-primary font-medium">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(activeLive.price)} / minuto
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate(`/live/${activeLive.id}`)}
                className="w-full"
              >
                {t.liveViewer?.live || "Watch Live"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-6xl mb-4">📺</div>
              <h3 className="text-xl font-semibold mb-2">
                {t.home?.offline || "Creator is offline"}
              </h3>
              <p className="text-muted-foreground">
                Check back later when they start streaming!
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CreatorRoom;
