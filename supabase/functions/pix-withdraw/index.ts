import { retiredPaymentHandler } from "../_shared/retired-payment.ts";

Deno.serve(retiredPaymentHandler("Saques automáticos por PIX indisponíveis."));
