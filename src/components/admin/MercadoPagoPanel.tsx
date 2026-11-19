import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reprocessMercadoPagoPayment } from "@/lib/mercadoPago";

const messages = {
  processed: "Pagamento aprovado e aplicado no StreamStar.",
  already_processed: "Este pagamento já foi aplicado no StreamStar.",
  already_paid: "Este pedido já foi liquidado por outro pagamento. Confira a cobrança na conta do Mercado Pago.",
  not_approved: "O Mercado Pago ainda não confirmou a aprovação.",
  unknown_order: "O pagamento não corresponde a um pedido desta integração.",
  amount_mismatch: "O valor ou a moeda não corresponde ao pedido.",
};

export default function MercadoPagoPanel() {
  const [paymentId, setPaymentId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const processPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);
    try {
      const { result } = await reprocessMercadoPagoPayment(paymentId.trim());
      setStatus(messages[result] || "O serviço retornou um resultado desconhecido.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamentos do Mercado Pago</CardTitle>
        <CardDescription>
          Se um pagamento aprovado ainda não apareceu no StreamStar, consulte pelo ID da transação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={processPayment} className="space-y-3">
          <Label htmlFor="mercadopago-payment-id">ID do pagamento</Label>
          <Input id="mercadopago-payment-id" inputMode="numeric" maxLength={24}
            value={paymentId} onChange={(event) => setPaymentId(event.target.value)} required />
          <Button type="submit" disabled={loading || !/^\d{1,24}$/.test(paymentId.trim())}>
            {loading ? "Consultando…" : "Consultar e processar"}
          </Button>
          {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
