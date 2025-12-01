// Lightweight, no-op analytics helper to keep the UI instrumented without
// requiring a real analytics provider. Replace `track` with a real emitter when
// available.
export type AnalyticsEvent =
  | "preview_started"
  | "preview_expired"
  | "paywall_rendered"
  | "entitlement_restored";

export function track(event: AnalyticsEvent, payload?: Record<string, unknown>) {
   
  console.debug(`[analytics] ${event}`, payload);
}
