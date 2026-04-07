import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WebhookLog {
  id: string;
  source: string;
  event_type: string | null;
  payload: any;
  status: string;
  error_message: string | null;
  retry_count: number;
  processed_at: string | null;
  created_at: string;
}

export const WebhookLogsPanel = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Processado</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      case 'ignored':
        return <Badge className="bg-muted text-muted-foreground"><Clock className="w-3 h-3 mr-1" />Ignorado</Badge>;
      case 'received':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Recebido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const retryWebhook = async (log: WebhookLog) => {
    if (!log.payload?.data?.id) {
      console.error('No payment ID in log payload');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-pending-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ paymentId: log.payload.data.id }),
        }
      );

      await response.json();

      // Refresh logs
      fetchLogs();
    } catch (error) {
      // retry failed silently
    }
  };

  return (
    <>
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Logs de Webhook</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum log de webhook encontrado</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(log.status)}
                      <span className="text-sm font-medium truncate">
                        {log.event_type || 'unknown'}
                      </span>
                      {log.retry_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {log.retry_count} retries
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                      {log.error_message && (
                        <span className="text-red-400 truncate max-w-48">
                          {log.error_message}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {(log.status === 'failed' || log.status === 'error') && log.payload?.data?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryWebhook(log)}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Webhook</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Evento</label>
                    <p className="mt-1 font-medium">{selectedLog.event_type || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Recebido em</label>
                    <p className="mt-1">{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Processado em</label>
                    <p className="mt-1">
                      {selectedLog.processed_at 
                        ? format(new Date(selectedLog.processed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Retries</label>
                    <p className="mt-1">{selectedLog.retry_count}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Fonte</label>
                    <p className="mt-1">{selectedLog.source}</p>
                  </div>
                </div>
                
                {selectedLog.error_message && (
                  <div>
                    <label className="text-sm text-muted-foreground">Mensagem de Erro</label>
                    <p className="mt-1 p-2 rounded bg-red-500/10 text-red-400 text-sm">
                      {selectedLog.error_message}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm text-muted-foreground">Payload</label>
                  <pre className="mt-1 p-3 rounded bg-muted/50 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
