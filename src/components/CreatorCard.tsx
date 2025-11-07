import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CreatorCardProps {
  id: string;
  displayName: string;
  bio?: string;
  tags?: string[];
  isStreaming: boolean;
  viewerCount: number;
  avatarUrl?: string;
}

const CreatorCard = ({
  id,
  displayName,
  bio,
  tags,
  isStreaming,
  viewerCount,
  avatarUrl,
}: CreatorCardProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isStreaming) {
      navigate(`/room/${id}`);
    }
  };

  return (
    <Card
      className={`overflow-hidden hover:shadow-glow transition-all duration-300 border-border bg-gradient-card cursor-pointer ${
        !isStreaming && "opacity-60"
      }`}
      onClick={handleClick}
    >
      <div className="relative aspect-video bg-secondary">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
        
        <div className="absolute top-2 left-2">
          <Badge
            variant={isStreaming ? "default" : "secondary"}
            className={`${
              isStreaming
                ? "bg-destructive text-white animate-pulse"
                : "bg-secondary"
            }`}
          >
            <Circle
              className={`h-2 w-2 mr-1 ${isStreaming ? "fill-white" : "fill-muted-foreground"}`}
            />
            {isStreaming ? "AO VIVO" : "OFFLINE"}
          </Badge>
        </div>

        {isStreaming && (
          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="text-xs font-medium">{viewerCount}</span>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-bold text-lg mb-1 truncate">{displayName}</h3>
        {bio && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {bio}
          </p>
        )}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreatorCard;
