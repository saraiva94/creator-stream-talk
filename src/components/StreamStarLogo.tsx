import { Video } from "lucide-react";

interface StreamStarLogoProps {
  size?: "default" | "large";
}

export const StreamStarLogo = ({ size = "default" }: StreamStarLogoProps) => {
  const isLarge = size === "large";
  
  return (
    <div className="flex items-center gap-2 group cursor-pointer">
      <div className="relative">
        {/* Neon glow effect using purple tones */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(280,85%,65%)] via-[hsl(265,80%,55%)] to-[hsl(250,75%,50%)] rounded-lg blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Icon with pulse animation */}
        <div className="relative neon-glow">
          <Video 
            className={`${isLarge ? "h-12 w-12" : "h-8 w-8"} text-[hsl(270,80%,60%)] transition-transform duration-300 group-hover:scale-110`} 
          />
          
          {/* Subtle ring animation */}
          <div className="absolute inset-0 rounded-lg border-2 border-[hsl(270,80%,60%)]/50 opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
        </div>
      </div>
      
      {/* Logo text with purple gradient */}
      <span className={`${isLarge ? "text-4xl" : "text-2xl"} font-bold bg-gradient-to-r from-[hsl(280,85%,65%)] via-[hsl(265,80%,55%)] to-[hsl(250,75%,50%)] bg-clip-text text-transparent`}>
        Stream Star
      </span>
    </div>
  );
};
