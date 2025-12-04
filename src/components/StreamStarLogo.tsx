import { Video } from "lucide-react";

export const StreamStarLogo = () => {
  return (
    <div className="flex items-center gap-2 group cursor-pointer">
      <div className="relative">
        {/* Neon glow effect using logo-specific colors */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(330,90%,60%)] via-[hsl(25,95%,55%)] to-[hsl(270,80%,60%)] rounded-lg blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Icon with pulse animation */}
        <div className="relative neon-glow">
          <Video className="h-8 w-8 text-[hsl(330,90%,60%)] transition-transform duration-300 group-hover:scale-110" />
          
          {/* Subtle ring animation */}
          <div className="absolute inset-0 rounded-lg border-2 border-[hsl(330,90%,60%)]/50 opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
        </div>
      </div>
      
      {/* Logo text with neon gradient (pink/orange/purple) */}
      <span className="text-2xl font-bold bg-gradient-to-r from-[hsl(330,90%,60%)] via-[hsl(25,95%,55%)] to-[hsl(270,80%,60%)] bg-clip-text text-transparent">
        Stream Star
      </span>
    </div>
  );
};
