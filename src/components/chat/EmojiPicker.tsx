import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export const EmojiPicker = ({ onEmojiSelect, disabled = false }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: { native: string }) => {
    onEmojiSelect(emoji.native);
    setOpen(false);
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
        className="w-auto p-0 border-border" 
        side="top" 
        align="start"
        sideOffset={8}
      >
        <Picker
          data={data}
          onEmojiSelect={handleSelect}
          theme="dark"
          locale="pt"
          previewPosition="none"
          skinTonePosition="none"
          maxFrequentRows={2}
          perLine={8}
        />
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
