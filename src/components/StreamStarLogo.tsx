import { Video } from "lucide-react";

export const StreamStarLogo = () => {
  return (
    <div className="flex items-center gap-2 group cursor-pointer">
      <div className="relative">
        {/* Glow effect on hover */}
        <div className="absolute inset-0 bg-primary/30 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Icon with pulse animation on hover */}
        <div className="relative">
          <Video className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
          
          {/* Subtle ring animation */}
          <div className="absolute inset-0 rounded-lg border-2 border-primary/50 opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
        </div>
      </div>
      
      <span className="text-2xl font-bold bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent group-hover:from-primary group-hover:via-purple-400 group-hover:to-primary transition-all duration-500">
        Stream Star
      </span>
    </div>
  );
};
