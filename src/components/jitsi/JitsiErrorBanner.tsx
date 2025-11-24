import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = {
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
};

const JitsiErrorBanner = ({ message, onRetry, isRetrying }: Props) => {
  if (!message) return null;

  return (
    <Alert variant="destructive" className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4" />
        <div>
          <AlertTitle>Problema na conexão</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "Tentando..." : "Tentar novamente"}
        </Button>
      )}
    </Alert>
  );
};

export default JitsiErrorBanner;
