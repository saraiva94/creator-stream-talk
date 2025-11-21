import React from "react";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaywallOverlayProps {
  priceLabel?: string;
  onPurchase: () => void;
  reason?: 'preview' | 'credits';
  remainingCredits?: number;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ priceLabel, onPurchase, reason = 'preview', remainingCredits }) => {
  const headline =
    reason === 'credits'
      ? 'Your credits have expired'
      : 'Preview ended';

  const description =
    reason === 'credits'
      ? 'Buy more credits to continue watching without interruption.'
      : 'Your preview has expired. Complete checkout to keep watching.';

  const creditsLabel =
    typeof remainingCredits === 'number'
      ? `Credits remaining: ${Math.max(0, Math.floor(remainingCredits))}`
      : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-6 text-center">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          <CreditCard className="h-5 w-5" />
          <span>{headline}</span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {creditsLabel && <p className="text-xs text-muted-foreground">{creditsLabel}</p>}
        <Button onClick={onPurchase} className="w-full">
          {priceLabel ? `Unlock for ${priceLabel}` : "Unlock access"}
        </Button>
      </div>
    </div>
  );
};

export default PaywallOverlay;
