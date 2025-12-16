import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Eye } from "lucide-react";

interface CreatorCardProps {
  creator: {
    id: string;
    display_name: string;
    bio: string | null;
    is_streaming: boolean;
    viewer_count: number;
    profiles: {
      username: string;
      avatar_url: string | null;
    };
  };
  onEnter: () => void;
}

const CreatorCard = ({ creator, onEnter }: CreatorCardProps) => {
  return (
    <Card
      onClick={onEnter}
      className="group cursor-pointer border-border hover:border-primary/50 transition-all hover:shadow-gold overflow-hidden"
    >
      <div className="relative aspect-video bg-secondary">
        {creator.profiles.avatar_url ? (
          <img
            src={creator.profiles.avatar_url}
            alt={creator.display_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-card">
            <Eye className="h-12 w-12 text-primary/50" />
          </div>
        )}
        
        {creator.is_streaming && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              LIVE
            </Badge>
          </div>
        )}
        
        {creator.is_streaming && (
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="flex items-center gap-1 bg-background/80 backdrop-blur-sm">
              <Users className="h-3 w-3" />
              {creator.viewer_count}
            </Badge>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={creator.profiles.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {creator.display_name[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
              {creator.display_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              @{creator.profiles.username}
            </p>
            {creator.bio && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {creator.bio}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreatorCard;
