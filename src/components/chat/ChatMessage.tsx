import { AudioPlayer } from "./AudioPlayer";

interface ChatMessageProps {
  message: {
    id: string;
    content: string;
    type: "text" | "image" | "audio";
    file_url?: string | null;
    duration?: number | null;
    user_id: string;
    created_at: string;
    profiles: {
      username: string;
    };
  };
  currentUserId: string;
}

export const ChatMessage = ({ message, currentUserId }: ChatMessageProps) => {
  const isOwn = message.user_id === currentUserId;

  const renderContent = () => {
    switch (message.type) {
      case "image":
        return message.file_url ? (
          <a 
            href={message.file_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block"
          >
            <img 
              src={message.file_url} 
              alt="Imagem enviada" 
              className="max-w-[200px] max-h-[200px] rounded-lg object-cover hover:opacity-90 transition-opacity"
              loading="lazy"
            />
          </a>
        ) : null;

      case "audio":
        return message.file_url ? (
          <AudioPlayer 
            src={message.file_url} 
            duration={message.duration || undefined}
          />
        ) : null;

      default:
        return (
          <p className="text-sm text-foreground break-words">
            {message.content}
          </p>
        );
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span
          className={`text-sm font-semibold ${
            isOwn ? "text-primary" : "text-foreground"
          }`}
        >
          {message.profiles.username}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {renderContent()}
    </div>
  );
};

export default ChatMessage;
