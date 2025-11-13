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
}

const SUPERCHAT_OPTIONS = [
  { amount: 2, color: "bg-blue-500" },
  { amount: 5, color: "bg-purple-500" },
  { amount: 10, color: "bg-yellow-500" },
];

const SuperChatDialog = ({
  open,
  onOpenChange,
  creatorId,
  userId,
}: SuperChatDialogProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
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
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          creatorId,
          userId,
          type: "superchat",
          amount: selectedAmount,
          description: message,
        },
      });

      if (error) throw error;

      // Redirect to Mercado Pago
      if (data?.init_point) {
        window.open(data.init_point, "_blank");
        toast({
          title: "Redirecionando para pagamento",
          description: "Complete o pagamento para enviar seu SuperChat",
        });
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar SuperChat",
        description: error.message,
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
            <Label>Escolha o valor</Label>
            <div className="grid grid-cols-3 gap-2">
              {SUPERCHAT_OPTIONS.map((option) => (
                <Button
                  key={option.amount}
                  variant={selectedAmount === option.amount ? "default" : "outline"}
                  onClick={() => setSelectedAmount(option.amount)}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="text-lg font-bold">R$ {option.amount}</span>
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

          <Button
            onClick={handleSendSuperChat}
            disabled={loading || !message.trim()}
            className="w-full"
          >
            {loading ? "Processando..." : `Enviar SuperChat de R$ ${selectedAmount}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuperChatDialog;
