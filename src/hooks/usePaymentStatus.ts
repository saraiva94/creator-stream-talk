/**
 * Hook para monitorar status de pagamento em tempo real via Supabase Realtime
 * Permite atualização automática da UI quando o pagamento é confirmado
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface PaymentIntent {
  id: string;
  user_id: string;
  external_ref: string;
  velana_transaction_id: string | null;
  purchase_type: string;
  amount_cents: number;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  error_message: string | null;
}

interface UsePaymentStatusOptions {
  externalRef: string | null;
  onPaid?: (intent: PaymentIntent) => void;
  onFailed?: (intent: PaymentIntent) => void;
  pollingIntervalMs?: number;
  maxPollingDurationMs?: number;
}

interface UsePaymentStatusResult {
  status: PaymentStatus | null;
  intent: PaymentIntent | null;
  isLoading: boolean;
  isPaid: boolean;
  isFailed: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const usePaymentStatus = ({
  externalRef,
  onPaid,
  onFailed,
  pollingIntervalMs = 3000,
  maxPollingDurationMs = 180000, // 3 minutes
}: UsePaymentStatusOptions): UsePaymentStatusResult => {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentIntent = useCallback(async () => {
    if (!externalRef) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('payment_intents')
        .select('*')
        .eq('external_ref', externalRef)
        .maybeSingle();

      if (fetchError) {
        logger.payment.error('Failed to fetch payment intent', { externalRef }, fetchError);
        setError(fetchError.message);
        return;
      }

      if (data) {
        const typedData = data as unknown as PaymentIntent;
        setIntent(typedData);
        setStatus(typedData.status);

        if (typedData.status === 'paid' && onPaid) {
          onPaid(typedData);
        } else if ((typedData.status === 'failed' || typedData.status === 'expired' || typedData.status === 'cancelled') && onFailed) {
          onFailed(typedData);
        }
      }

      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.payment.error('Error fetching payment intent', { externalRef }, err as Error);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [externalRef, onPaid, onFailed]);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    if (!externalRef) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchPaymentIntent();

    // Setup Realtime subscription
    const channel = supabase
      .channel(`payment_intent:${externalRef}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_intents',
          filter: `external_ref=eq.${externalRef}`,
        },
        (payload) => {
          logger.payment.info('Payment intent updated via realtime', { 
            externalRef, 
            newStatus: payload.new?.status 
          });
          
          const updatedIntent = payload.new as unknown as PaymentIntent;
          setIntent(updatedIntent);
          setStatus(updatedIntent.status);

          if (updatedIntent.status === 'paid' && onPaid) {
            onPaid(updatedIntent);
          } else if ((updatedIntent.status === 'failed' || updatedIntent.status === 'expired' || updatedIntent.status === 'cancelled') && onFailed) {
            onFailed(updatedIntent);
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [externalRef, fetchPaymentIntent, onPaid, onFailed]);

  // Fallback polling for cases where Realtime might not work
  useEffect(() => {
    if (!externalRef || status === 'paid' || status === 'failed' || status === 'expired' || status === 'cancelled') {
      return;
    }

    const startTime = Date.now();

    const pollInterval = setInterval(() => {
      // Stop polling after max duration
      if (Date.now() - startTime > maxPollingDurationMs) {
        logger.payment.warn('Payment polling timeout reached', { externalRef });
        clearInterval(pollInterval);
        return;
      }

      fetchPaymentIntent();
    }, pollingIntervalMs);

    return () => {
      clearInterval(pollInterval);
    };
  }, [externalRef, status, pollingIntervalMs, maxPollingDurationMs, fetchPaymentIntent]);

  return {
    status,
    intent,
    isLoading,
    isPaid: status === 'paid',
    isFailed: status === 'failed' || status === 'expired' || status === 'cancelled',
    error,
    refetch: fetchPaymentIntent,
  };
};

export default usePaymentStatus;
