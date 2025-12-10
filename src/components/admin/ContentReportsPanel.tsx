import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, XCircle, Eye, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { format } from "date-fns";
import { ptBR, es, enUS } from "date-fns/locale";

type ContentReport = {
  id: string;
  live_id: string;
  creator_id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reporter_profile?: { username: string; avatar_url: string | null } | null;
  creator_profile?: { display_name: string } | null;
};

const REASON_LABELS: Record<string, { en: string; es: string; pt: string }> = {
  inappropriate: { en: "Inappropriate Content", es: "Contenido Inapropiado", pt: "Conteúdo Impróprio" },
  harassment: { en: "Harassment", es: "Acoso", pt: "Assédio" },
  spam: { en: "Spam", es: "Spam", pt: "Spam" },
  violence: { en: "Violence", es: "Violencia", pt: "Violência" },
  copyright: { en: "Copyright", es: "Derechos de Autor", pt: "Direitos Autorais" },
  other: { en: "Other", es: "Otro", pt: "Outro" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  reviewed: "bg-green-500/20 text-green-400 border-green-500/50",
  dismissed: "bg-muted text-muted-foreground border-muted",
};

export const ContentReportsPanel = () => {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const getLocale = () => {
    switch (language) {
      case "pt": return ptBR;
      case "es": return es;
      default: return enUS;
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;

      // Fetch reporter and creator profiles
      const reportsWithProfiles = await Promise.all(
        (data || []).map(async (report) => {
          const [reporterRes, creatorRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("username, avatar_url")
              .eq("id", report.reporter_id)
              .maybeSingle(),
            supabase
              .from("creator_profiles")
              .select("display_name")
              .eq("id", report.creator_id)
              .maybeSingle(),
          ]);
          
          return {
            ...report,
            reporter_profile: reporterRes.data,
            creator_profile: creatorRes.data,
          };
        })
      );

      setReports(reportsWithProfiles);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: t.admin?.error || "Erro",
        description: "Erro ao carregar denúncias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const handleUpdateStatus = async (reportId: string, newStatus: "reviewed" | "dismissed") => {
    setActionLoading(reportId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("content_reports")
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", reportId);

      if (error) throw error;

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: user?.id || null }
            : r
        )
      );

      toast({
        title: newStatus === "reviewed" ? "Denúncia analisada" : "Denúncia dispensada",
        description: "Status atualizado com sucesso",
      });
    } catch (error) {
      console.error("Error updating report status:", error);
      toast({
        title: t.admin?.error || "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels = REASON_LABELS[reason];
    if (!labels) return reason;
    return labels[language as keyof typeof labels] || labels.en;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return language === "pt" ? "Pendente" : language === "es" ? "Pendiente" : "Pending";
      case "reviewed": return language === "pt" ? "Analisada" : language === "es" ? "Revisada" : "Reviewed";
      case "dismissed": return language === "pt" ? "Dispensada" : language === "es" ? "Desestimada" : "Dismissed";
      default: return status;
    }
  };

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div>
              <CardTitle className="text-foreground">
                {language === "pt" ? "Denúncias de Conteúdo" : language === "es" ? "Reportes de Contenido" : "Content Reports"}
              </CardTitle>
              <CardDescription>
                {language === "pt" 
                  ? `${pendingCount} denúncia(s) pendente(s)` 
                  : language === "es" 
                    ? `${pendingCount} reporte(s) pendiente(s)` 
                    : `${pendingCount} pending report(s)`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "pt" ? "Todas" : language === "es" ? "Todos" : "All"}
                </SelectItem>
                <SelectItem value="pending">
                  {language === "pt" ? "Pendentes" : language === "es" ? "Pendientes" : "Pending"}
                </SelectItem>
                <SelectItem value="reviewed">
                  {language === "pt" ? "Analisadas" : language === "es" ? "Revisados" : "Reviewed"}
                </SelectItem>
                <SelectItem value="dismissed">
                  {language === "pt" ? "Dispensadas" : language === "es" ? "Desestimados" : "Dismissed"}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchReports} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "pt" 
              ? "Nenhuma denúncia encontrada" 
              : language === "es" 
                ? "No se encontraron reportes" 
                : "No reports found"}
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-lg border border-border bg-muted/20 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={STATUS_COLORS[report.status]}>
                          {report.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {report.status === "reviewed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {report.status === "dismissed" && <XCircle className="h-3 w-3 mr-1" />}
                          {getStatusLabel(report.status)}
                        </Badge>
                        <Badge variant="secondary">
                          {getReasonLabel(report.reason)}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">
                          {language === "pt" ? "Denunciante: " : language === "es" ? "Reportado por: " : "Reporter: "}
                        </span>
                        <span className="font-medium">{report.reporter_profile?.username || "Desconhecido"}</span>
                      </p>
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">
                          {language === "pt" ? "Criador: " : language === "es" ? "Creador: " : "Creator: "}
                        </span>
                        <span className="font-medium">{report.creator_profile?.display_name || "Desconhecido"}</span>
                      </p>
                      {report.description && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          "{report.description}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(report.created_at), "dd MMM yyyy 'às' HH:mm", { locale: getLocale() })}
                      </p>
                    </div>
                    
                    {report.status === "pending" && (
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-400 border-green-500/50 hover:bg-green-500/20"
                          onClick={() => handleUpdateStatus(report.id, "reviewed")}
                          disabled={actionLoading === report.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {language === "pt" ? "Analisar" : language === "es" ? "Revisar" : "Review"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground"
                          onClick={() => handleUpdateStatus(report.id, "dismissed")}
                          disabled={actionLoading === report.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {language === "pt" ? "Dispensar" : language === "es" ? "Desestimar" : "Dismiss"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
