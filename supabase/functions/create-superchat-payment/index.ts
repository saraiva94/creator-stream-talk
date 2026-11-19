import { checkout } from "../_shared/mercadopago.ts";

Deno.serve(checkout("superchat"));
