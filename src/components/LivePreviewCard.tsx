import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LiveLifecycleStatus, LiveSummary } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LivePreviewCardProps {
  live: LiveSummary;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
}

const LivePreviewCard = ({ live, isLoggedIn, onLoginRequired }: LivePreviewCardProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [creatorInfo, setCreatorInfo] = useState<{
    display_name: string;
    avatar_url: string | null;
  } | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreatorInfo = async () => {
      // Try to get from creator_profiles first
      const { data: creatorProfile } = await supabase
        .from("creator_profiles")
        .select("display_name")
        .eq("id", live.creator_id)
        .single();

      // Get avatar from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url, username")
        .eq("id", live.creator_id)
        .single();

      setCreatorInfo({
        display_name: creatorProfile?.display_name || profile?.username || live.creator_username || "Criador",
        avatar_url: profile?.avatar_url || null,
      });
    };

    fetchCreatorInfo();
  }, [live.creator_id, live.creator_username]);

  // Fetch thumbnail from lives table
  useEffect(() => {
    const fetchThumbnail = async () => {
      const { data } = await supabase
        .from("lives")
        .select("thumbnail_url")
        .eq("id", live.id)
        .single();

      if (data?.thumbnail_url) {
        setThumbnailUrl(data.thumbnail_url);
      }
    };

    fetchThumbnail();
  }, [live.id]);

  const handleEnter = () => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    navigate(`/live/${live.id}`);
  };

  const statusLabel = (status: LiveLifecycleStatus | null | undefined) => {
    switch (status) {
      case "live":
        return "Live";
      case "waiting_for_host":
        return t.home.viewers ? "Aguardando" : "Waiting";
      case "scheduled":
        return "Agendado";
      case "inactive":
        return "Inativo";
      case "ending":
        return "Encerrando";
      case "ended":
        return "Encerrado";
      default:
        return "Unknown";
    }
  };

  const badgeClass = (status: LiveLifecycleStatus | null | undefined) => {
    switch (status) {
      case "live":
        return "bg-destructive text-white";
      case "waiting_for_host":
      case "scheduled":
        return "bg-amber-500 text-white";
      case "ended":
        return "bg-muted text-foreground";
      default:
        return "bg-secondary text-foreground";
    }
  };

  const priceDisplay = live.price ? `R$ ${live.price.toFixed(2)}` : "Free";

  // Determine which image to show: custom thumbnail > avatar > placeholder
  const displayImage = thumbnailUrl || creatorInfo?.avatar_url;

  return (
    <Card className="h-full flex flex-col border-border bg-card shadow-sm overflow-hidden">
      {/* Thumbnail - prioritize custom thumbnail, then avatar */}
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 via-background to-secondary overflow-hidden">
        {displayImage ? (
          <img
            src={displayImage}
            alt={creatorInfo?.display_name || "Live"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl font-bold text-primary/30">
              {creatorInfo?.display_name?.slice(0, 2).toUpperCase() || "??"}
            </span>
          </div>
        )}
        
        {/* Live badge overlay */}
        {live.status === "live" && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-destructive text-white animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full mr-1.5 inline-block" />
              LIVE
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Badge className={badgeClass(live.status)}>{statusLabel(live.status)}</Badge>
          <span className="text-sm text-muted-foreground">{priceDisplay}</span>
        </div>

        <div className="space-y-2 flex-1">
          <h3 className="font-semibold text-foreground line-clamp-1">
            {live.title || "Live Stream"}
          </h3>
          {live.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{live.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {creatorInfo?.display_name || "Carregando..."}
          </p>
        </div>

        <Button onClick={handleEnter} className="w-full" disabled={live.status === "ended"}>
          {live.status === "ended" ? "Encerrado" : "Assistir"}
        </Button>
      </div>
    </Card>
  );
};

export default LivePreviewCard;
