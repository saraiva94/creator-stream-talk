import { retiredPaymentHandler } from "../_shared/retired-payment.ts";

Deno.serve(retiredPaymentHandler("Conciliação automática de transferências desativada."));
