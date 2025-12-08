import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Trash2, Edit2, Smile, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { DirectMessageAudioPlayer } from "./DirectMessageAudioPlayer";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type?: string;
  metadata?: { file_url?: string; duration?: number; reactions?: Record<string, string[]> } | null;
}

interface DirectChatMessageProps {
  message: Message;
  isOwn: boolean;
  currentUserId: string;
  onDelete: (messageId: string) => Promise<void>;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  isDeleting?: boolean;
}

export const DirectChatMessage = ({
  message,
  isOwn,
  currentUserId,
  onDelete,
  onEdit,
  onReact,
  isDeleting = false,
}: DirectChatMessageProps) => {
  const { t } = useLanguage();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const isAudio = message.message_type === "audio" && message.metadata?.file_url;
  const reactions = message.metadata?.reactions || {};

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.selectionStart = editInputRef.current.value.length;
    }
  }, [isEditing]);

  const handleConfirmDelete = async () => {
    await onDelete(message.id);
    setShowConfirmDelete(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false);
      setEditContent(message.content);
      return;
    }
    setIsSaving(true);
    await onEdit(message.id, editContent.trim());
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleReaction = async (emoji: string) => {
    await onReact(message.id, emoji);
    setShowReactionPicker(false);
  };

  // Render reactions
  const renderReactions = () => {
    const reactionEntries = Object.entries(reactions);
    if (reactionEntries.length === 0) return null;

    return (
      <div className={cn(
        "flex flex-wrap gap-1 mt-1",
        isOwn ? "justify-end" : "justify-start"
      )}>
        {reactionEntries.map(([emoji, userIds]) => (
          <button
            key={emoji}
            onClick={() => onReact(message.id, emoji)}
            className={cn(
              "text-xs px-1.5 py-0.5 rounded-full bg-muted hover:bg-muted/80 transition-colors flex items-center gap-0.5",
              userIds.includes(currentUserId) && "ring-1 ring-primary"
            )}
          >
            <span>{emoji}</span>
            {userIds.length > 1 && <span className="text-muted-foreground">{userIds.length}</span>}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg text-sm w-fit max-w-[85%]",
        isOwn ? "ml-auto" : ""
      )}
    >
      {/* Action menu - shows on hover for own messages */}
      {isOwn && !isEditing && !showConfirmDelete && (
        <div className="absolute top-1/2 -translate-y-1/2 -left-8 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              side="left" 
              className="min-w-0 p-1.5 bg-card border border-border shadow-lg"
            >
              <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
                <PopoverTrigger asChild>
                  <DropdownMenuItem 
                    onSelect={(e) => e.preventDefault()}
                    className="px-2 py-1.5"
                  >
                    <Smile className="h-4 w-4 mr-2" />
                    {t.chat?.react || "Reagir"}
                  </DropdownMenuItem>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 border-0 z-50" 
                  side="left" 
                  align="start"
                  onInteractOutside={() => setShowReactionPicker(false)}
                >
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: { native: string }) => handleReaction(emoji.native)}
                    theme="dark"
                    previewPosition="none"
                    skinTonePosition="none"
                    maxFrequentRows={1}
                    perLine={8}
                  />
                </PopoverContent>
              </Popover>
              {!isAudio && (
                <DropdownMenuItem 
                  onClick={() => setIsEditing(true)}
                  className="px-2 py-1.5"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {t.chat?.edit || "Editar"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => setShowConfirmDelete(true)}
                className="text-destructive focus:text-destructive px-2 py-1.5"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t.chat?.delete || "Excluir"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Reaction button for non-own messages */}
      {!isOwn && !isEditing && (
        <div className="absolute top-1/2 -translate-y-1/2 -right-8 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 border-0 z-50" 
              side="right" 
              align="start"
              onInteractOutside={() => setShowReactionPicker(false)}
            >
              <Picker
                data={data}
                onEmojiSelect={(emoji: { native: string }) => handleReaction(emoji.native)}
                theme="dark"
                previewPosition="none"
                skinTonePosition="none"
                maxFrequentRows={1}
                perLine={8}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Delete confirmation popup - positioned beside the message */}
      {showConfirmDelete && (
        <div className="absolute top-1/2 -translate-y-1/2 -left-28 z-20 flex items-center gap-1 bg-card border border-border rounded-lg p-1.5 shadow-lg animate-in fade-in slide-in-from-right-2 duration-200">
          <span className="text-xs text-muted-foreground px-1 whitespace-nowrap">
            {t.chat?.confirmDelete || "Excluir?"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-muted"
            onClick={() => setShowConfirmDelete(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Message content */}
      {isAudio ? (
        <div className={cn(
          "p-1.5 rounded-lg",
          isOwn ? "bg-primary/10" : "bg-muted"
        )}>
          <DirectMessageAudioPlayer 
            src={message.metadata!.file_url!}
            duration={message.metadata?.duration}
          />
        </div>
      ) : isEditing ? (
        <div className={cn(
          "p-2 rounded-lg",
          isOwn ? "bg-primary/20" : "bg-muted"
        )}>
          <textarea
            ref={editInputRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-transparent text-sm resize-none outline-none min-h-[24px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSaveEdit();
              }
              if (e.key === "Escape") {
                setIsEditing(false);
                setEditContent(message.content);
              }
            }}
          />
          <div className="flex justify-end gap-1 mt-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={() => {
                setIsEditing(false);
                setEditContent(message.content);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn(
          "p-2 rounded-lg break-words whitespace-pre-wrap",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}>
          {message.content}
        </div>
      )}

      {/* Reactions display */}
      {renderReactions()}
    </div>
  );
};
