import { retiredPaymentHandler } from "../_shared/retired-payment.ts";

Deno.serve(retiredPaymentHandler("Webhook de pagamentos desativado."));
