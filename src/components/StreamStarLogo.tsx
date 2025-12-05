import { Video } from "lucide-react";

interface StreamStarLogoProps {
  size?: "default" | "large";
  variant?: "neon" | "purple";
}

export const StreamStarLogo = ({ size = "default", variant = "neon" }: StreamStarLogoProps) => {
  const isLarge = size === "large";
  
  // Color schemes
  const colors = variant === "neon" 
    ? {
        gradient: "from-[hsl(330,90%,60%)] via-[hsl(25,95%,55%)] to-[hsl(270,80%,60%)]",
        icon: "text-[hsl(330,90%,60%)]",
        ring: "border-[hsl(330,90%,60%)]/50"
      }
    : {
        gradient: "from-[hsl(280,85%,65%)] via-[hsl(265,80%,55%)] to-[hsl(250,75%,50%)]",
        icon: "text-[hsl(270,80%,60%)]",
        ring: "border-[hsl(270,80%,60%)]/50"
      };
  
  return (
    <div className="flex items-center gap-2 group cursor-pointer">
      <div className="relative">
        {/* Neon glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} rounded-lg blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
        
        {/* Icon with pulse animation */}
        <div className="relative neon-glow">
          <Video 
            className={`${isLarge ? "h-12 w-12" : "h-8 w-8"} ${colors.icon} transition-transform duration-300 group-hover:scale-110`} 
          />
          
          {/* Subtle ring animation */}
          <div className={`absolute inset-0 rounded-lg border-2 ${colors.ring} opacity-0 group-hover:opacity-100 group-hover:animate-ping`} />
        </div>
      </div>
      
      {/* Logo text with gradient */}
      <span className={`${isLarge ? "text-4xl" : "text-2xl"} font-bold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
        Stream Star
      </span>
    </div>
  );
};
