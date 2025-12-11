import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronRight, User, MessageSquare } from "lucide-react";
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

type CreatorWithReports = {
  creator_id: string;
  display_name: string;
  reports: ContentReport[];
  pendingCount: number;
};

const REASON_LABELS: Record<string, { en: string; es: string; pt: string }> = {
  inappropriate_content: { en: "Inappropriate Content", es: "Contenido Inapropiado", pt: "Conteúdo Impróprio" },
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
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
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

  // Group reports by creator
  const creatorsWithReports: CreatorWithReports[] = Object.values(
    reports.reduce((acc, report) => {
      if (!acc[report.creator_id]) {
        acc[report.creator_id] = {
          creator_id: report.creator_id,
          display_name: report.creator_profile?.display_name || "Desconhecido",
          reports: [],
          pendingCount: 0,
        };
      }
      acc[report.creator_id].reports.push(report);
      if (report.status === "pending") {
        acc[report.creator_id].pendingCount++;
      }
      return acc;
    }, {} as Record<string, CreatorWithReports>)
  ).sort((a, b) => b.pendingCount - a.pendingCount);

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

      if (selectedReport?.id === reportId) {
        setSelectedReport((prev) => prev ? { ...prev, status: newStatus } : null);
      }

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

  const toggleCreator = (creatorId: string) => {
    setExpandedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) {
        next.delete(creatorId);
      } else {
        next.add(creatorId);
      }
      return next;
    });
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

  const totalPendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <>
      <Card className="bg-card border-border mb-6">
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
                    ? `${totalPendingCount} denúncia(s) pendente(s)` 
                    : language === "es" 
                      ? `${totalPendingCount} reporte(s) pendiente(s)` 
                      : `${totalPendingCount} pending report(s)`}
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
          ) : creatorsWithReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "pt" 
                ? "Nenhuma denúncia encontrada" 
                : language === "es" 
                  ? "No se encontraron reportes" 
                  : "No reports found"}
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {creatorsWithReports.map((creator) => (
                  <Collapsible
                    key={creator.creator_id}
                    open={expandedCreators.has(creator.creator_id)}
                    onOpenChange={() => toggleCreator(creator.creator_id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                          {expandedCreators.has(creator.creator_id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <User className="h-5 w-5 text-primary" />
                          <span className="font-medium text-foreground">{creator.display_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {creator.pendingCount > 0 && (
                            <Badge variant="outline" className={STATUS_COLORS.pending}>
                              {creator.pendingCount} {language === "pt" ? "pendente(s)" : language === "es" ? "pendiente(s)" : "pending"}
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {creator.reports.length} {language === "pt" ? "denúncia(s)" : language === "es" ? "reporte(s)" : "report(s)"}
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 mt-2 space-y-2">
                        {creator.reports.map((report) => (
                          <div
                            key={report.id}
                            onClick={() => setSelectedReport(report)}
                            className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={STATUS_COLORS[report.status]}>
                                    {report.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                                    {report.status === "reviewed" && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {report.status === "dismissed" && <XCircle className="h-3 w-3 mr-1" />}
                                    {getStatusLabel(report.status)}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {getReasonLabel(report.reason)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(report.created_at), "dd MMM yyyy 'às' HH:mm", { locale: getLocale() })}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              {language === "pt" ? "Detalhes da Denúncia" : language === "es" ? "Detalles del Reporte" : "Report Details"}
            </DialogTitle>
            <DialogDescription>
              {language === "pt" ? "Informações completas da denúncia" : language === "es" ? "Información completa del reporte" : "Complete report information"}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={STATUS_COLORS[selectedReport.status]}>
                  {selectedReport.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                  {selectedReport.status === "reviewed" && <CheckCircle className="h-3 w-3 mr-1" />}
                  {selectedReport.status === "dismissed" && <XCircle className="h-3 w-3 mr-1" />}
                  {getStatusLabel(selectedReport.status)}
                </Badge>
              </div>

              {/* Reporter */}
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "pt" ? "Denunciante" : language === "es" ? "Reportado por" : "Reporter"}
                </p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedReport.reporter_profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {selectedReport.reporter_profile?.username?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{selectedReport.reporter_profile?.username || "Desconhecido"}</span>
                </div>
              </div>

              {/* Reason */}
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "pt" ? "Motivo" : language === "es" ? "Razón" : "Reason"}
                </p>
                <Badge variant="secondary">
                  {getReasonLabel(selectedReport.reason)}
                </Badge>
              </div>

              {/* Description */}
              {selectedReport.description && (
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "pt" ? "Descrição" : language === "es" ? "Descripción" : "Description"}
                  </p>
                  <p className="text-sm text-foreground italic">"{selectedReport.description}"</p>
                </div>
              )}

              {/* Date */}
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "pt" ? "Data" : language === "es" ? "Fecha" : "Date"}
                </p>
                <p className="text-sm font-medium">
                  {format(new Date(selectedReport.created_at), "dd MMM yyyy 'às' HH:mm", { locale: getLocale() })}
                </p>
              </div>

              {/* Actions */}
              {selectedReport.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedReport.id, "reviewed")}
                    disabled={actionLoading === selectedReport.id}
                  >
                    <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                    {language === "pt" ? "Analisar" : language === "es" ? "Revisar" : "Review"}
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedReport.id, "dismissed")}
                    disabled={actionLoading === selectedReport.id}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {language === "pt" ? "Dispensar" : language === "es" ? "Desestimar" : "Dismiss"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
