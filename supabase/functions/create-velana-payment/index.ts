import { retiredPaymentHandler } from "../_shared/retired-payment.ts";

Deno.serve(retiredPaymentHandler("Pagamentos PIX indisponíveis."));
