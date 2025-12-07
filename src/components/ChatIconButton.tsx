import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatIconButtonProps {
  onClick: () => void;
  className?: string;
  size?: "sm" | "default";
}

export const ChatIconButton = ({ onClick, className, size = "default" }: ChatIconButtonProps) => {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-full",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className
      )}
    >
      <MessageCircle className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
    </Button>
  );
};

export default ChatIconButton;
