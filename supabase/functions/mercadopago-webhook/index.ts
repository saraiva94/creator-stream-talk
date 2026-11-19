import {
  paymentHandler,
  paymentResponse,
  processPayment,
  validPaymentId,
  verifyNotification,
} from "../_shared/mercadopago.ts";

Deno.serve(paymentHandler(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("type") !== "payment") return paymentResponse({ received: true });
  const paymentId = url.searchParams.get("data.id") ?? "";
  if (!validPaymentId(paymentId) || !await verifyNotification(req, paymentId)) {
    return paymentResponse({ error: "Notificação inválida." }, 401);
  }
  const result = await processPayment(paymentId);
  if (result === "already_paid" || result === "amount_mismatch") {
    console.error("Mercado Pago payment requires review:", paymentId, result);
  }
  return paymentResponse({ received: true });
}));
