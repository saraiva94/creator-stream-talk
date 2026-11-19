import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type PaymentResult = "processed" | "already_processed" | "already_paid" | "not_approved" | "unknown_order" | "amount_mismatch";

async function invokePayment<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error instanceof FunctionsHttpError) {
    const details = await error.context.json().catch(() => null);
    if (typeof details?.error === "string") throw new Error(details.error);
  }
  if (error || !data) throw new Error("Não foi possível conectar ao serviço de pagamentos.");
  return data;
}

export async function openMercadoPagoCheckout(
  name: "create-payment" | "registration-checkout" | "create-superchat-payment",
  body: Record<string, unknown>,
) {
  const { checkoutUrl } = await invokePayment<{ checkoutUrl: string }>(name, body);
  window.location.assign(checkoutUrl);
}

export const reprocessMercadoPagoPayment = (paymentId: string) =>
  invokePayment<{ result: PaymentResult }>("process-pending-payment", { paymentId });
