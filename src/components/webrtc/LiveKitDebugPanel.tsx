import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

interface DebugResult {
  rawLivekitUrl?: string;
  normalizedWsUrl?: string;
  normalizedHttpUrl?: string;
  reachability?: {
    ok: boolean;
    status?: number;
    errorMessage?: string;
  };
  apiKeyPresent?: boolean;
  apiSecretPresent?: boolean;
  timestamp?: string;
  error?: string;
}

/**
 * LiveKit Debug Panel - Only shown in DEV mode
 * Allows testing LiveKit configuration and reachability
 */
export const LiveKitDebugPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const runDebug = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    console.log('[LiveKitDebugPanel] Starting debug request...');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('livekit-room', {
        body: { action: 'debug' }
      });

      console.log('[LiveKitDebugPanel] Edge function response:', { data, error: invokeError });

      if (invokeError) {
        const errMsg = invokeError.message || 'Edge function error';
        console.error('[LiveKitDebugPanel] Invoke error:', invokeError);
        setError(errMsg);
        return;
      }

      if (data?.error) {
        console.error('[LiveKitDebugPanel] Data error:', data.error);
        setError(data.error);
        return;
      }

      setResult(data);
      console.log('[LiveKitDebugPanel] Debug result:', JSON.stringify(data, null, 2));

    } catch (err: any) {
      console.error('[LiveKitDebugPanel] Exception:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 p-4 bg-background/95 border border-border rounded-lg shadow-lg max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <Bug className="w-4 h-4 text-yellow-500" />
        <span className="text-sm font-medium text-foreground">LiveKit Debug (DEV)</span>
      </div>

      <Button 
        onClick={runDebug} 
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="w-full mb-3"
      >
        {isLoading ? 'Testing...' : 'Test LiveKit Connection'}
      </Button>

      {error && (
        <div className="p-2 bg-destructive/20 border border-destructive/50 rounded text-xs text-destructive mb-2">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="p-2 bg-muted rounded text-xs font-mono space-y-1 max-h-60 overflow-auto">
          <div>
            <span className="text-muted-foreground">Raw URL:</span>{' '}
            <span className="text-foreground break-all">{result.rawLivekitUrl || 'N/A'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">WS URL:</span>{' '}
            <span className="text-foreground break-all">{result.normalizedWsUrl || 'N/A'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">HTTP URL:</span>{' '}
            <span className="text-foreground break-all">{result.normalizedHttpUrl || 'N/A'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Reachability:</span>{' '}
            <span className={result.reachability?.ok ? 'text-green-500' : 'text-destructive'}>
              {result.reachability?.ok 
                ? `✓ OK (${result.reachability.status})` 
                : `✗ Failed: ${result.reachability?.errorMessage || 'Unknown'}`}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">API Key:</span>{' '}
            <span className={result.apiKeyPresent ? 'text-green-500' : 'text-destructive'}>
              {result.apiKeyPresent ? '✓ Present' : '✗ Missing'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">API Secret:</span>{' '}
            <span className={result.apiSecretPresent ? 'text-green-500' : 'text-destructive'}>
              {result.apiSecretPresent ? '✓ Present' : '✗ Missing'}
            </span>
          </div>
          <div className="text-muted-foreground text-[10px] pt-1 border-t border-border mt-1">
            {result.timestamp}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-2">
        Check browser console for detailed logs
      </p>
    </div>
  );
};

export default LiveKitDebugPanel;
