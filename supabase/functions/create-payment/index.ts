import { checkout } from "../_shared/mercadopago.ts";

Deno.serve(checkout("credits_purchase"));
