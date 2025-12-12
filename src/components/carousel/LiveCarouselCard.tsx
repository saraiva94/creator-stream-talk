import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { LiveSummary } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

interface LiveCarouselCardProps {
  live: LiveSummary;
  isCenter: boolean;
}

const LiveCarouselCard = ({ live, isCenter }: LiveCarouselCardProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [creatorAvatar, setCreatorAvatar] = useState<string | null>(null);

  useEffect(() => {
    const fetchThumbnail = async () => {
      // First try to get live thumbnail
      const { data: liveData } = await supabase
        .from('lives')
        .select('thumbnail_url')
        .eq('id', live.id)
        .maybeSingle();
      
      if (liveData?.thumbnail_url) {
        setThumbnailUrl(liveData.thumbnail_url);
        return;
      }

      // Fallback to creator avatar
      const { data: profileData } = await supabase
        .from('public_profiles')
        .select('avatar_url')
        .eq('id', live.creator_id)
        .maybeSingle();
      
      if (profileData?.avatar_url) {
        setCreatorAvatar(profileData.avatar_url);
      }
    };

    fetchThumbnail();
  }, [live.id, live.creator_id]);

  const displayImage = thumbnailUrl || creatorAvatar;

  return (
    <div className="relative w-full h-full bg-card overflow-hidden">
      {/* Background - thumbnail or gradient */}
      {displayImage ? (
        <img 
          src={displayImage} 
          alt={live.title || "Live"} 
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <Play className="w-8 h-8 sm:w-12 sm:h-12 text-primary/50" />
        </div>
      )}

      {/* Live badge */}
      <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex items-center gap-1 sm:gap-1.5 bg-destructive px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold text-white">
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
        AO VIVO
      </div>

      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-3">
        <p className="text-white font-semibold text-xs sm:text-sm truncate">{live.title || "Live Stream"}</p>
        <p className="text-white/70 text-[10px] sm:text-xs truncate">{live.creator_username || "Creator"}</p>
      </div>

      {/* Play overlay on center */}
      {isCenter && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-5 h-5 sm:w-7 sm:h-7 text-white fill-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveCarouselCard;
