import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

// Common emoji categories
const EMOJI_CATEGORIES = {
  smileys: ["😀", "😂", "🥹", "😍", "🥰", "😘", "😎", "🤩", "😇", "🤗", "🫠", "😏", "😭", "🥺", "😤", "😡", "🤯", "🫡", "🤔", "🙄"],
  gestures: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "🫶", "❤️", "🔥", "💯", "⭐", "✨", "💫", "🎉", "🎊", "👀", "💪", "🙏", "💀"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💕", "💗", "💓", "💝", "💘", "❣️", "💔", "♥️", "🫀", "💌", "💞"],
  misc: ["🤑", "🤠", "😈", "👻", "💩", "🤡", "👽", "🤖", "🎃", "💋", "🦋", "🌈", "☀️", "🌙", "⚡", "🍕", "🎮", "📱", "💰", "🏆"]
};

export const EmojiPicker = ({ onEmojiSelect, disabled = false }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<keyof typeof EMOJI_CATEGORIES>("smileys");

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  const categoryLabels = {
    smileys: "😀",
    gestures: "👍",
    hearts: "❤️",
    misc: "🎮"
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled}
          title="Emojis"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-2 border-border" 
        side="top" 
        align="start"
        sideOffset={8}
      >
        {/* Category tabs */}
        <div className="flex gap-1 mb-2 pb-2 border-b border-border">
          {(Object.keys(EMOJI_CATEGORIES) as Array<keyof typeof EMOJI_CATEGORIES>).map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 text-lg"
              onClick={() => setCategory(cat)}
            >
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>
        
        {/* Emoji grid */}
        <div className="grid grid-cols-10 gap-1">
          {EMOJI_CATEGORIES[category].map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              type="button"
              className="h-7 w-7 text-lg hover:bg-muted rounded cursor-pointer flex items-center justify-center transition-colors"
              onClick={() => handleSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
