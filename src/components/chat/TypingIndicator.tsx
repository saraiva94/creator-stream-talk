import { useLanguage } from "@/hooks/useLanguage";

interface TypingIndicatorProps {
  usernames: string[];
}

export const TypingIndicator = ({ usernames }: TypingIndicatorProps) => {
  const { t } = useLanguage();

  if (usernames.length === 0) return null;

  const getTypingText = () => {
    if (usernames.length === 1) {
      return t.chat?.isTyping 
        ? t.chat.isTyping.replace("{name}", usernames[0])
        : `${usernames[0]} está digitando...`;
    }
    
    if (usernames.length === 2) {
      return t.chat?.areTyping
        ? t.chat.areTyping.replace("{names}", usernames.join(" e "))
        : `${usernames[0]} e ${usernames[1]} estão digitando...`;
    }
    
    return t.chat?.multipleTyping
      ? t.chat.multipleTyping.replace("{count}", String(usernames.length))
      : `${usernames.length} pessoas estão digitando...`;
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="italic">{getTypingText()}</span>
    </div>
  );
};

export default TypingIndicator;
