import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openMercadoPagoCheckout } from "@/lib/mercadoPago";

const tiers = [
  { name: "blue", label: "1 min · R$ 3,00" },
  { name: "yellow", label: "2 min · R$ 5,00" },
  { name: "red", label: "3 min · R$ 8,00" },
] as const;

type Props = { roomId: string; onClose: () => void };

export default function SuperChatDialog({ roomId, onClose }: Props) {
  const [tier, setTier] = useState<(typeof tiers)[number]["name"]>("yellow");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkout = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await openMercadoPagoCheckout("create-superchat-payment", { roomId, tier, message: message.trim() });
    } catch (error) {
      setError((error as Error).message);
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SuperChat</DialogTitle>
          <DialogDescription>Escolha por quanto tempo sua mensagem ficará em destaque.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={checkout}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {tiers.map(({ name, label }) => (
              <Button key={name} type="button" variant={tier === name ? "default" : "outline"}
                aria-pressed={tier === name} disabled={loading} onClick={() => setTier(name)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="superchat-message">Mensagem</Label>
            <Input id="superchat-message" value={message} onChange={(event) => setMessage(event.target.value)}
              maxLength={150} disabled={loading} required />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !message.trim()}>
            Pagar com Mercado Pago
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
