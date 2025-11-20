import React from "react";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaywallOverlayProps {
  priceLabel?: string;
  onPurchase: () => void;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ priceLabel, onPurchase }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-6 text-center">
    <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-center gap-2 text-lg font-semibold">
        <CreditCard className="h-5 w-5" />
        <span>Preview ended</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Your preview has expired. Complete checkout to keep watching without interruptions.
      </p>
      <Button onClick={onPurchase} className="w-full">
        {priceLabel ? `Unlock for ${priceLabel}` : "Unlock access"}
      </Button>
    </div>
  </div>
);

export default PaywallOverlay;
