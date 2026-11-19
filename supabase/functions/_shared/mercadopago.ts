import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const api = "https://api.mercadopago.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

class PaymentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export const paymentResponse = (body: object, status = 200) =>
  Response.json(body, { status, headers: cors });

export function paymentHandler(action: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return paymentResponse({ error: "Método inválido." }, 405);
    try {
      return await action(req);
    } catch (error) {
      if (error instanceof PaymentError) return paymentResponse({ error: error.message }, error.status);
      console.error("Mercado Pago:", error instanceof Error ? error.message : "Erro no processamento");
      return paymentResponse({ error: "Não foi possível processar o pagamento. Tente novamente." }, 500);
    }
  };
}

export function paymentDatabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Database = ReturnType<typeof paymentDatabase>;

async function paymentUser(db: Database, req: Request) {
  const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new PaymentError("Entre na sua conta para continuar.", 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new PaymentError("Sessão inválida ou expirada.", 401);
  return data.user;
}

async function payload(req: Request) {
  const data = await req.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new PaymentError("Dados inválidos.", 400);
  }
  return data as Record<string, unknown>;
}

function accessToken() {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")?.trim();
  if (!token) throw new PaymentError("Mercado Pago indisponível.", 503);
  return token;
}

function webhookSecret() {
  const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET")?.trim();
  if (!secret) throw new PaymentError("Notificações do Mercado Pago indisponíveis.", 503);
  return secret;
}

type Order = {
  id: string;
  amount_cents: number;
  checkout_url: string | null;
  checkout_started_at: string;
  approved_at: string | null;
};

type Product = {
  kind: "credits_purchase" | "registration" | "superchat";
  title: string;
  returnPath: string;
  amountCents: number;
  details: Record<string, unknown>;
};

const packages = new Map([[180, 500], [360, 900]]);
const tiers = new Map([
  ["blue", { amountCents: 300, duration: 60 }],
  ["yellow", { amountCents: 500, duration: 120 }],
  ["red", { amountCents: 800, duration: 180 }],
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function productFor(kind: Product["kind"], body: Record<string, unknown>, db: Database, userId: string): Promise<Product> {
  if (kind === "credits_purchase") {
    const credits = typeof body.credits === "number" ? body.credits : 0;
    const amountCents = packages.get(credits);
    if (!amountCents) throw new PaymentError("Pacote de créditos inválido.", 400);
    return { kind, title: `${credits} créditos`, returnPath: "/profile", amountCents, details: { credits } };
  }

  if (kind === "superchat") {
    const tier = String(body.tier ?? "");
    const level = tiers.get(tier);
    const roomId = String(body.roomId ?? "");
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!level || !uuid.test(roomId) || !message || message.length > 150) {
      throw new PaymentError("Escolha um SuperChat e escreva uma mensagem de até 150 caracteres.", 400);
    }
    const { data: room, error } = await db.from("rooms").select("creator_id, is_active").eq("id", roomId).maybeSingle();
    if (error) throw error;
    if (!room?.is_active || room.creator_id === userId) {
      throw new PaymentError("SuperChat indisponível nesta sala.", 400);
    }
    return {
      kind, title: "SuperChat", returnPath: "/dashboard", amountCents: level.amountCents,
      details: { room_id: roomId, creator_id: room.creator_id, tier, message, duration: level.duration },
    };
  }

  const code = typeof body.referralCode === "string" ? body.referralCode.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) throw new PaymentError("Informe um código de indicação válido.", 400);
  const { data: profile, error: profileError } = await db
    .from("profiles").select("status, is_subscribed").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.status !== "pending_payment" || profile.is_subscribed) {
    throw new PaymentError("Sua conta não tem uma ativação pendente.", 409);
  }
  const { data: referrer, error } = await db
    .from("profiles").select("id, referred_by").eq("referral_code", code).maybeSingle();
  if (error) throw error;
  if (!referrer || referrer.id === userId) throw new PaymentError("Código de indicação inválido.", 400);
  const root = [userId, referrer.id].includes(referrer.referred_by) ? null : referrer.referred_by;
  return {
    kind, title: "Ativação de conta", returnPath: "/subscribe", amountCents: 700,
    details: { direct_id: referrer.id, root_id: root, referral_code: code },
  };
}

async function reserveOrder(db: Database, product: Product, userId: string): Promise<Order> {
  const columns = "id, amount_cents, checkout_url, checkout_started_at, approved_at";
  const { data, error } = await db.from("mercadopago_orders").insert({
    user_id: userId, kind: product.kind, amount_cents: product.amountCents, details: product.details,
  }).select(columns).single();
  if (!error) return data;
  if (product.kind !== "registration" || error.code !== "23505") throw error;

  const { data: existing, error: existingError } = await db.from("mercadopago_orders")
    .select(columns).eq("user_id", userId).eq("kind", "registration").single();
  if (existingError) throw existingError;
  if (existing.approved_at) throw new PaymentError("A ativação da conta já foi paga.", 409);
  if (existing.checkout_url) return existing;

  const staleSince = new Date(Date.now() - 60_000).toISOString();
  const { data: reclaimed, error: claimError } = await db.from("mercadopago_orders")
    .update({ checkout_started_at: new Date().toISOString() })
    .eq("id", existing.id).is("checkout_url", null).lt("checkout_started_at", staleSince)
    .select(columns).maybeSingle();
  if (claimError) throw claimError;
  if (!reclaimed) throw new PaymentError("Já existe um checkout em preparação. Tente novamente em instantes.", 409);
  return reclaimed;
}

export const checkout = (kind: Product["kind"]) => paymentHandler(async (req) => {
  const db = paymentDatabase();
  const user = await paymentUser(db, req);
  if (kind === "registration" && !user.email_confirmed_at) {
    throw new PaymentError("Confirme seu e-mail antes de pagar a ativação.", 403);
  }
  const token = accessToken();
  webhookSecret();
  const product = await productFor(kind, await payload(req), db, user.id);
  const order = await reserveOrder(db, product, user.id);
  if (order.checkout_url) return paymentResponse({ checkoutUrl: order.checkout_url });

  const site = new URL(Deno.env.get("SITE_URL") || "https://streamstar.vercel.app");
  const returnUrl = new URL(product.returnPath, site);
  const paymentReturn = new URL(returnUrl);
  paymentReturn.searchParams.set("checkout", "returned");
  const hook = new URL("/functions/v1/mercadopago-webhook", Deno.env.get("SUPABASE_URL")!);

  const provider = await fetch(`${api}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: `StreamStar - ${product.title}`, quantity: 1, unit_price: order.amount_cents / 100, currency_id: "BRL" }],
      external_reference: order.id,
      notification_url: hook.href,
      back_urls: { success: paymentReturn.href, pending: paymentReturn.href, failure: returnUrl.href },
      auto_return: "approved",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!provider.ok) {
    console.error("Mercado Pago checkout status:", provider.status);
    throw new PaymentError("Não foi possível abrir o checkout do Mercado Pago.", 502);
  }
  const preference = await provider.json();
  const target = new URL(token.startsWith("TEST-") ? preference.sandbox_init_point : preference.init_point);
  if (target.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.br)?$/.test(target.hostname)) {
    throw new Error("Invalid checkout URL from provider");
  }
  const { error } = await db.from("mercadopago_orders").update({ checkout_url: target.href })
    .eq("id", order.id).eq("checkout_started_at", order.checkout_started_at);
  if (error) throw error;
  return paymentResponse({ checkoutUrl: target.href });
});

export async function verifyNotification(req: Request, paymentId: string): Promise<boolean> {
  const requestId = req.headers.get("x-request-id");
  const parts = (req.headers.get("x-signature") ?? "").split(",")
    .map((part) => part.trim().split("=", 2));
  const signature: Record<string, string | undefined> = Object.fromEntries(parts);
  if (!requestId || !/^\d+$/.test(signature.ts ?? "") || !/^[a-f\d]{64}$/i.test(signature.v1 ?? "")) {
    return false;
  }
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", bytes.encode(webhookSecret()),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const pairs = signature.v1!.match(/../g)!;
  const digest = Uint8Array.from(pairs, (pair) => parseInt(pair, 16));
  const manifest = `id:${paymentId};request-id:${requestId};ts:${signature.ts};`;
  return crypto.subtle.verify("HMAC", key, digest, bytes.encode(manifest));
}

export const validPaymentId = (value: string) => /^\d{1,24}$/.test(value);

export async function processPayment(paymentId: string, db = paymentDatabase()) {
  if (!validPaymentId(paymentId)) throw new PaymentError("Informe o ID numérico do pagamento.", 400);
  const response = await fetch(`${api}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    signal: AbortSignal.timeout(9_000),
  });
  if (response.status === 404) throw new PaymentError("Pagamento não encontrado nesta conta do Mercado Pago.", 404);
  if (!response.ok) throw new PaymentError("Não foi possível consultar o Mercado Pago.", 502);
  const payment = await response.json();
  if (String(payment.id) !== paymentId) throw new Error("Payment ID mismatch");
  if (payment.status !== "approved") return "not_approved";
  const amount = payment.transaction_amount;
  if (payment.currency_id !== "BRL" || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "amount_mismatch";
  }
  if (typeof payment.external_reference !== "string" || !uuid.test(payment.external_reference)) return "unknown_order";

  const { data, error } = await db.rpc("complete_mercadopago_order", {
    p_order_id: payment.external_reference,
    p_payment_id: paymentId,
    p_amount_cents: Math.round(amount * 100),
    p_method: payment.payment_method_id ?? null,
  });
  if (error) throw error;
  return data as string;
}

export const adminProcessPayment = paymentHandler(async (req) => {
  const db = paymentDatabase();
  const user = await paymentUser(db, req);
  const { data: role, error } = await db.from("user_roles").select("user_id")
    .eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (error) throw error;
  if (!role) throw new PaymentError("Acesso exclusivo de administradores.", 403);
  const body = await payload(req);
  const result = await processPayment(typeof body.paymentId === "string" ? body.paymentId.trim() : "", db);
  return paymentResponse({ result });
});
