import React from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CreditCard, ShieldCheck, RefreshCw } from "lucide-react";

import {
  api,
  ApiError,
  LiveAccessResponse,
  LiveInfoResponse,
  LiveLifecycleStatus,
  PaymentPreferenceResponse,
} from "@/lib/api";
import { retryWithBackoff } from "@/lib/backoff";
import { track } from "@/lib/analytics";
import { usePreviewTimer } from "@/hooks/usePreviewTimer";
import { useToast } from "@/hooks/use-toast";
import { JitsiPlayer } from "@/components/JitsiPlayer";
import PreviewCountdownOverlay from "@/components/PreviewCountdownOverlay";
import PaywallOverlay from "@/components/PaywallOverlay";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface ViewerAccessGateProps {
  liveId: string;
}

type ViewerAccessPhase =
  | "loading-info"
  | "unpaid"
  | "purchasing"
  | "payment-pending"
  | "verifying-access"
  | "access-granted"
  | "error";

type ViewerLiveInfo = LiveInfoResponse & {
  price?: number | null;
  currency?: string | null;
  creatorName?: string | null;
  isEntitled?: boolean;
  requiresPayment?: boolean;
};

const PAYMENT_SIGNAL_PARAMS = ["payment_id", "preference_id", "collection_id", "collection_status", "status"];

const ACCESS_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];
const ENTITLEMENT_WAIT_MESSAGE =
  "Your payment was approved, but we’re still waiting for Mercado Pago to confirm your access. Please refresh or try again.";

const LIVE_STATUS_LABELS: Record<LiveLifecycleStatus, string> = {
  scheduled: "Scheduled",
  waiting_for_host: "Waiting for Host",
  live: "Live",
  inactive: "Inactive",
  ending: "Ending",
  ended: "Ended",
};

const formatCurrency = (amount?: number | null, currency = "USD") => {
  if (typeof amount !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const extractRoomNameFromUrl = (url?: string | null) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.pop() ?? null;
  } catch {
    return null;
  }
};

const ViewerAccessGate: React.FC<ViewerAccessGateProps> = ({ liveId }) => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [liveInfo, setLiveInfo] = React.useState<ViewerLiveInfo | null>(null);
  const [phase, setPhase] = React.useState<ViewerAccessPhase>("loading-info");
  const [access, setAccess] = React.useState<LiveAccessResponse | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [paymentInit, setPaymentInit] = React.useState<PaymentPreferenceResponse | null>(null);
  const [accessInFlight, setAccessInFlight] = React.useState(false);
  const [isRetryingAccess, setIsRetryingAccess] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const initialAttemptedRef = React.useRef(false);
  const isMountedRef = React.useRef(true);
  const retryAbortRef = React.useRef<AbortController | null>(null);
  const previewStartedRef = React.useRef(false);
  const paywallLoggedRef = React.useRef(false);
  const hasEntitlement = Boolean(access || liveInfo?.isEntitled);
  const previewRole = isAuthenticated ? "authenticated" : "anonymous";
  const previewTimer = usePreviewTimer({
    role: previewRole,
    entitlementState: hasEntitlement ? "entitled" : "unentitled",
    liveId,
  });
  const { start: startPreview, stop: stopPreview, isPreviewing, hasExpired, remainingMs, durationMs } = previewTimer;

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      retryAbortRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setIsAuthenticated(Boolean(data.session));
      })
      .catch(() => undefined);

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return;
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const serializedSearch = searchParams.toString();
  const hasPaymentSignal = React.useMemo(
    () => PAYMENT_SIGNAL_PARAMS.some((param) => searchParams.get(param) !== null),
    [serializedSearch, searchParams],
  );

  const clearPaymentSignals = React.useCallback(() => {
    const next = new URLSearchParams(searchParams);
    let mutated = false;
    PAYMENT_SIGNAL_PARAMS.forEach((param) => {
      if (next.has(param)) {
        next.delete(param);
        mutated = true;
      }
    });
    if (mutated) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  React.useEffect(() => {
    const loadInfo = async () => {
      setPhase("loading-info");
      setErrorMessage(null);
      try {
        const data = await api.lives.getInfo(liveId);
        if (!isMountedRef.current) return;
        setLiveInfo(data);
      } catch (error) {
        if (!isMountedRef.current) return;
        const message = error instanceof ApiError ? error.message : "Failed to load live info";
        setErrorMessage(message);
        setPhase("error");
      }
    };

    loadInfo();

    return () => {
      initialAttemptedRef.current = false;
      previewStartedRef.current = false;
      paywallLoggedRef.current = false;
      stopPreview();
    };
  }, [liveId, stopPreview]);

  React.useEffect(() => {
    initialAttemptedRef.current = false;
  }, [hasPaymentSignal]);

  const attemptAccess = React.useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (accessInFlight || access) return { success: true };
    setAccessInFlight(true);
    try {
      const accessResponse = await api.lives.access(liveId);
      if (!isMountedRef.current) return { success: true };
      setAccess(accessResponse);
      setPhase("access-granted");
      clearPaymentSignals();
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to verify access";
      return { success: false, message };
    } finally {
      if (isMountedRef.current) {
        setAccessInFlight(false);
      }
    }
  }, [access, accessInFlight, clearPaymentSignals, liveId]);

  const verifyAccessWithRetry = React.useCallback(
    async (enableBackoff: boolean) => {
      if (access || accessInFlight) return;
      setPhase("verifying-access");
      setErrorMessage(null);
      setIsRetryingAccess(enableBackoff);
      retryAbortRef.current?.abort();
      retryAbortRef.current = new AbortController();

      let lastError: string | undefined;

      const result = await retryWithBackoff<{ success: boolean; message?: string }>({
        attempt: async () => {
          const outcome = await attemptAccess();
          if (outcome.success) return outcome;
          lastError = outcome.message ?? lastError;
          return null;
        },
        delaysMs: enableBackoff ? ACCESS_RETRY_DELAYS_MS : [],
        isCancelled: () => !isMountedRef.current,
        signal: retryAbortRef.current?.signal,
        onAttempt: (attempt, delay) => {
          // eslint-disable-next-line no-console
          console.debug(`[viewer] entitlement retry attempt ${attempt} after ${delay}ms`);
        },
      });

      if (!isMountedRef.current) return;
      setIsRetryingAccess(false);

      if (result) return;

      const fallbackMessage = enableBackoff ? ENTITLEMENT_WAIT_MESSAGE : lastError ?? "Unable to verify access";
      setErrorMessage(fallbackMessage);
      setPhase("error");
    },
    [access, accessInFlight, attemptAccess],
  );

  React.useEffect(() => {
    if (!liveInfo || access || accessInFlight) return;

    const shouldRetry = Boolean(hasPaymentSignal);

    if (liveInfo.isEntitled || hasPaymentSignal) {
      if (initialAttemptedRef.current) return;
      initialAttemptedRef.current = true;
      if (hasPaymentSignal) {
        setPhase("payment-pending");
        console.debug("[viewer] payment signal detected, waiting for webhook before granting access");
      }
      verifyAccessWithRetry(shouldRetry);
      return;
    }

    setPhase("unpaid");
  }, [access, accessInFlight, hasPaymentSignal, liveInfo, verifyAccessWithRetry]);

  React.useEffect(() => {
    if (hasEntitlement) {
      stopPreview();
      previewStartedRef.current = true;
      return;
    }

    if (!liveInfo || hasExpired || previewStartedRef.current) return;
    const started = startPreview();
    if (started) {
      previewStartedRef.current = true;
    }
  }, [hasEntitlement, hasExpired, liveInfo, startPreview, stopPreview]);

  React.useEffect(() => {
    if (hasExpired && !paywallLoggedRef.current) {
      track("paywall_rendered", { liveId });
      paywallLoggedRef.current = true;
    }
  }, [hasExpired, liveId]);

  React.useEffect(() => {
    if (access && hasExpired) {
      track("entitlement_restored", { liveId });
      stopPreview();
    }
  }, [access, hasExpired, liveId, stopPreview]);

  const handlePurchase = async () => {
    setErrorMessage(null);
    setPhase("purchasing");
    try {
      console.debug("[viewer] creating payment preference", { liveId });
      const preference = await api.payments.create({ liveId });
      setPaymentInit(preference);
      if (preference?.init_point) {
        window.location.href = preference.init_point;
        return;
      }
      throw new Error("Mercado Pago preference missing init_point");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to start checkout";
      setErrorMessage(message);
      setPhase("unpaid");
      toast({
        title: "Checkout error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleManualRetry = () => {
    initialAttemptedRef.current = false;
    verifyAccessWithRetry(true);
  };

  const resolvedRoomName = React.useMemo(() => {
    if (access?.roomName) return access.roomName;
    if (liveInfo?.roomName) return liveInfo.roomName;
    return extractRoomNameFromUrl(access?.accessUrl ?? liveInfo?.jitsiUrl ?? null);
  }, [access, liveInfo]);

  const priceLabel = formatCurrency(liveInfo?.price ?? undefined, liveInfo?.currency ?? undefined);
  const statusLabel = liveInfo?.status ? LIVE_STATUS_LABELS[liveInfo.status] ?? liveInfo.status : "Unknown";
  const showPreviewPlayer = Boolean(!hasEntitlement && !hasExpired && resolvedRoomName);
  const showPaywall = Boolean(!hasEntitlement && hasExpired);
  const showCountdown = isPreviewing && !hasExpired;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{liveInfo?.title ?? "Live session"}</CardTitle>
          <CardDescription>
            {liveInfo?.creatorName ? `Hosted by ${liveInfo.creatorName}` : "Secure streaming session"}
          </CardDescription>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{statusLabel}</Badge>
            {typeof liveInfo?.price === "number" && (
              <span className="font-medium">Ticket: {priceLabel}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(resolvedRoomName && (hasEntitlement || showPreviewPlayer || showPaywall)) && (
            <div className="mb-4">
              <div className="relative overflow-hidden rounded-lg border">
                {!showPaywall && resolvedRoomName && (
                  <JitsiPlayer roomName={resolvedRoomName} height="600px" />
                )}

                {showCountdown && (
                  <PreviewCountdownOverlay remainingMs={remainingMs} totalMs={durationMs} />
                )}

                {showPaywall && (
                  <PaywallOverlay priceLabel={priceLabel} onPurchase={handlePurchase} />
                )}
              </div>
            </div>
          )}

          {phase === "loading-info" && (
            <StateMessage
              icon={<Loader2 className="h-5 w-5 animate-spin" />}
              title="Loading live details"
              description="Fetching entitlement status and pricing"
            />
          )}

          {phase === "unpaid" && (
            <div className="space-y-4">
              <StateMessage
                icon={<CreditCard className="h-5 w-5" />}
                title="Purchase access"
                description="Complete the Mercado Pago checkout to unlock this session."
              />
              <Button onClick={handlePurchase} className="w-full">
                Buy access ({priceLabel})
              </Button>
            </div>
          )}

          {phase === "purchasing" && (
            <StateMessage
              icon={<Loader2 className="h-5 w-5 animate-spin" />}
              title="Redirecting to Mercado Pago"
              description="Please approve the payment in the new tab"
            />
          )}

          {phase === "payment-pending" && (
            <StateMessage
              icon={<RefreshCw className="h-5 w-5 animate-spin" />}
              title="Payment detected"
              description="Confirming your access with the server..."
            />
          )}

          {phase === "verifying-access" && (
            <StateMessage
              icon={<Loader2 className="h-5 w-5 animate-spin" />}
              title="Verifying your access"
              description={
                isRetryingAccess
                  ? "Hang tight while we confirm your purchase. This can take a few seconds. If access takes too long, we’ll keep checking in the background."
                  : "Hang tight while we check your entitlement"
              }
            />
          )}

          {phase === "access-granted" && resolvedRoomName && (
            <div className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Access granted</AlertTitle>
                <AlertDescription>
                  You are now authorized to join this live session. Share links only with trusted viewers.
                </AlertDescription>
              </Alert>
              <JitsiPlayer roomName={resolvedRoomName} height="600px" />
            </div>
          )}

          {phase === "error" && errorMessage && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertTitle>Unable to continue</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                If access takes too long, we’ll keep checking in the background.
              </p>
              <Button variant="outline" onClick={handleManualRetry} className="w-full">
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {paymentInit && phase === "purchasing" && (
        <Alert>
          <AlertTitle>Waiting for Mercado Pago</AlertTitle>
          <AlertDescription>
            If you were not redirected automatically, follow this link:
            <a
              href={paymentInit.init_point}
              className="ml-2 text-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              Open checkout
            </a>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

interface StateMessageProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
}

const StateMessage: React.FC<StateMessageProps> = ({ icon, title, description }) => (
  <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
    <div className="mt-0.5 text-muted-foreground">{icon}</div>
    <div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  </div>
);

export default ViewerAccessGate;
