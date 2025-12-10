import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Eye, Clock, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VideoAnalytics {
  video_id: string;
  video_title: string;
  total_views: number;
  unique_viewers: number;
  avg_watch_time: number;
  completion_rate: number;
}

interface RecentView {
  id: string;
  video_title: string;
  watch_duration_seconds: number;
  completed: boolean;
  viewed_at: string;
  user_id: string | null;
}

const PromoVideoAnalyticsPanel = () => {
  const [analytics, setAnalytics] = useState<VideoAnalytics[]>([]);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch all views with video info
      const { data: viewsData, error: viewsError } = await supabase
        .from('promo_video_views')
        .select(`
          id,
          video_id,
          user_id,
          session_id,
          watch_duration_seconds,
          completed,
          viewed_at
        `)
        .order('viewed_at', { ascending: false });

      if (viewsError) throw viewsError;

      // Fetch video titles
      const { data: videosData } = await supabase
        .from('promotional_videos')
        .select('id, title');

      const videoTitles = new Map(videosData?.map(v => [v.id, v.title]) || []);

      // Calculate analytics per video
      const videoStats = new Map<string, {
        views: number;
        uniqueSessions: Set<string>;
        totalWatchTime: number;
        completions: number;
      }>();

      viewsData?.forEach(view => {
        const stats = videoStats.get(view.video_id) || {
          views: 0,
          uniqueSessions: new Set<string>(),
          totalWatchTime: 0,
          completions: 0
        };

        stats.views++;
        if (view.session_id) stats.uniqueSessions.add(view.session_id);
        stats.totalWatchTime += view.watch_duration_seconds || 0;
        if (view.completed) stats.completions++;

        videoStats.set(view.video_id, stats);
      });

      const analyticsData: VideoAnalytics[] = Array.from(videoStats.entries()).map(([videoId, stats]) => ({
        video_id: videoId,
        video_title: videoTitles.get(videoId) || 'Vídeo removido',
        total_views: stats.views,
        unique_viewers: stats.uniqueSessions.size,
        avg_watch_time: stats.views > 0 ? Math.round(stats.totalWatchTime / stats.views) : 0,
        completion_rate: stats.views > 0 ? Math.round((stats.completions / stats.views) * 100) : 0
      }));

      // Sort by total views
      analyticsData.sort((a, b) => b.total_views - a.total_views);

      // Recent views (last 20)
      const recentViewsData: RecentView[] = (viewsData?.slice(0, 20) || []).map(v => ({
        id: v.id,
        video_title: videoTitles.get(v.video_id) || 'Vídeo removido',
        watch_duration_seconds: v.watch_duration_seconds || 0,
        completed: v.completed || false,
        viewed_at: v.viewed_at,
        user_id: v.user_id
      }));

      setAnalytics(analyticsData);
      setRecentViews(recentViewsData);
      setTotalViews(viewsData?.length || 0);
    } catch (error) {
      console.error('Error fetching promo analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border mb-6">
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando analytics...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalViews}</p>
                <p className="text-xs text-muted-foreground">Total de Views</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <BarChart3 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.length}</p>
                <p className="text-xs text-muted-foreground">Vídeos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analytics.length > 0 
                    ? Math.round(analytics.reduce((acc, a) => acc + a.avg_watch_time, 0) / analytics.length)
                    : 0}s
                </p>
                <p className="text-xs text-muted-foreground">Tempo Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analytics.length > 0 
                    ? Math.round(analytics.reduce((acc, a) => acc + a.completion_rate, 0) / analytics.length)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Taxa de Conclusão</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Video Analytics */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-primary" />
            Analytics por Vídeo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma visualização registrada ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vídeo</TableHead>
                  <TableHead className="text-center">Views</TableHead>
                  <TableHead className="text-center">Únicos</TableHead>
                  <TableHead className="text-center">Tempo Médio</TableHead>
                  <TableHead className="text-center">Conclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.map((video) => (
                  <TableRow key={video.video_id}>
                    <TableCell className="font-medium">{video.video_title}</TableCell>
                    <TableCell className="text-center">{video.total_views}</TableCell>
                    <TableCell className="text-center">{video.unique_viewers}</TableCell>
                    <TableCell className="text-center">{video.avg_watch_time}s</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={video.completion_rate >= 70 ? "default" : video.completion_rate >= 40 ? "secondary" : "outline"}
                        className={video.completion_rate >= 70 ? "bg-green-500" : ""}
                      >
                        {video.completion_rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Views */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            Visualizações Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentViews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma visualização recente
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vídeo</TableHead>
                  <TableHead className="text-center">Duração</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Usuário</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentViews.map((view) => (
                  <TableRow key={view.id}>
                    <TableCell className="font-medium">{view.video_title}</TableCell>
                    <TableCell className="text-center">{view.watch_duration_seconds}s</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={view.completed ? "default" : "secondary"}>
                        {view.completed ? "Completo" : "Parcial"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {view.user_id ? (
                        <Badge variant="outline">Logado</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Anônimo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(new Date(view.viewed_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PromoVideoAnalyticsPanel;
