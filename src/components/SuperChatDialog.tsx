import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Coins } from "lucide-react";

interface SuperChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  userId: string;
  roomId: string;
}

export const SUPERCHAT_TIERS = [
  { amount: 3, tier: "blue", color: "bg-blue-500", duration: 60, label: "1 minuto" },
  { amount: 5, tier: "yellow", color: "bg-yellow-500", duration: 120, label: "2 minutos" },
  { amount: 8, tier: "red", color: "bg-red-500", duration: 180, label: "3 minutos" },
] as const;

const SuperChatDialog = ({
  open,
  onOpenChange,
  creatorId,
  userId,
  roomId,
}: SuperChatDialogProps) => {
  const [selectedTier, setSelectedTier] = useState<typeof SUPERCHAT_TIERS[number]>(SUPERCHAT_TIERS[1]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendSuperChat = async () => {
    if (!message.trim()) {
      toast({
        title: "Mensagem obrigatória",
        description: "Digite uma mensagem para o SuperChat",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-superchat-payment", {
        body: {
          creatorId,
          userId,
          roomId,
          tier: selectedTier.tier,
          amount: selectedTier.amount,
          duration: selectedTier.duration,
          message: message.trim(),
        },
      });

      if (error) throw error;

      if (data?.init_point) {
        window.open(data.init_point, "_blank");
        toast({
          title: "Redirecionando para pagamento",
          description: "Complete o pagamento para enviar seu SuperChat",
        });
        onOpenChange(false);
        setMessage("");
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Não foi possível enviar o SuperChat";
      toast({
        title: "Erro ao enviar SuperChat",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Enviar SuperChat
          </DialogTitle>
          <DialogDescription>
            Destaque sua mensagem com um SuperChat colorido
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Escolha o valor e duração</Label>
            <div className="grid grid-cols-3 gap-2">
              {SUPERCHAT_TIERS.map((tier) => (
                <Button
                  key={tier.tier}
                  variant={selectedTier.tier === tier.tier ? "default" : "outline"}
                  onClick={() => setSelectedTier(tier)}
                  className={`flex flex-col h-auto py-3 ${
                    selectedTier.tier === tier.tier ? tier.color : ""
                  }`}
                >
                  <span className="text-lg font-bold">R$ {tier.amount}</span>
                  <span className="text-xs opacity-80">{tier.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="superchat-message">Sua mensagem</Label>
            <Input
              id="superchat-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/200 caracteres
            </p>
          </div>

          <div className={`p-3 rounded-lg ${selectedTier.color} animate-pulse`}>
            <p className="text-white text-sm font-medium">Prévia do SuperChat</p>
            <p className="text-white text-xs mt-1">{message || "Sua mensagem aparecerá aqui..."}</p>
          </div>

          <Button
            onClick={handleSendSuperChat}
            disabled={loading || !message.trim()}
            className="w-full"
          >
            {loading ? "Processando..." : `Enviar SuperChat R$ ${selectedTier.amount}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuperChatDialog;
