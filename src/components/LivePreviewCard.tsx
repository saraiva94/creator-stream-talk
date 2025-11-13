import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Circle } from "lucide-react";
import DailyVideoPlayer from "./DailyVideoPlayer";

interface LivePreviewCardProps {
  creator: {
    id: string;
    display_name: string;
    bio: string | null;
    is_streaming: boolean;
    viewer_count: number;
    daily_room_url: string | null;
    profiles: {
      username: string;
      avatar_url: string | null;
    };
  };
  isLoggedIn: boolean;
  onLoginRequired: () => void;
}

const LivePreviewCard = ({ creator, isLoggedIn, onLoginRequired }: LivePreviewCardProps) => {
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(30);
  const [isBlurred, setIsBlurred] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showPreview && !isLoggedIn && previewTime > 0) {
      timerRef.current = setInterval(() => {
        setPreviewTime((prev) => {
          if (prev <= 1) {
            setIsBlurred(true);
            setShowLoginModal(true);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showPreview, isLoggedIn, previewTime]);

  const handleCardClick = () => {
    if (!creator.is_streaming) return;
    
    if (isLoggedIn) {
      navigate(`/room/${creator.id}`);
    } else {
      setShowPreview(true);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewTime(30);
    setIsBlurred(false);
    setShowLoginModal(false);
  };

  const handleLoginClick = () => {
    handleClosePreview();
    onLoginRequired();
  };

  return (
    <>
      <Card
        className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/20 border-border bg-card"
        onClick={handleCardClick}
      >
        <div className="relative aspect-video bg-secondary overflow-hidden">
          {creator.profiles.avatar_url ? (
            <img
              src={creator.profiles.avatar_url}
              alt={creator.display_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-900/20">
              <Users className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
          
          {creator.is_streaming && (
            <Badge className="absolute top-2 left-2 bg-destructive text-white animate-pulse">
              <Circle className="h-2 w-2 mr-1 fill-white" />
              LIVE
            </Badge>
          )}
          
          {creator.is_streaming && (
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded flex items-center gap-1">
              <Users className="h-3 w-3 text-white" />
              <span className="text-xs text-white font-medium">{creator.viewer_count}</span>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarImage src={creator.profiles.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {creator.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {creator.display_name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                @{creator.profiles.username}
              </p>
            </div>
          </div>
          
          {creator.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
              {creator.bio}
            </p>
          )}
        </div>
      </Card>

      <Dialog open={showPreview} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-4xl p-0">
          <div className="relative">
            {!isLoggedIn && previewTime > 0 && (
              <div className="absolute top-4 right-4 z-50 bg-black/80 px-4 py-2 rounded-lg">
                <p className="text-white text-sm font-medium">
                  Preview: {previewTime}s restantes
                </p>
              </div>
            )}
            
            <div className={`aspect-video ${isBlurred ? 'blur-lg' : ''}`}>
              {creator.daily_room_url && (
                <DailyVideoPlayer roomUrl={creator.daily_room_url} isCreator={false} />
              )}
            </div>

            {isBlurred && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="text-center p-8 bg-card border border-border rounded-lg max-w-md">
                  <h3 className="text-2xl font-bold mb-2 text-foreground">
                    Continue Assistindo
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Faça login ou crie uma conta para continuar assistindo esta transmissão ao vivo
                  </p>
                  <Button onClick={handleLoginClick} size="lg" className="w-full">
                    Fazer Login / Criar Conta
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoginModal && !showPreview} onOpenChange={() => setShowLoginModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tempo de Preview Esgotado</DialogTitle>
            <DialogDescription>
              Para continuar assistindo, faça login ou crie uma conta gratuita.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleLoginClick} className="w-full">
            Fazer Login / Criar Conta
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LivePreviewCard;
