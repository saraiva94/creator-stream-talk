import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Eye, Clock, TrendingUp, Users, Calendar } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

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

interface TimeSeriesData {
  date: string;
  views: number;
  completions: number;
}

type TimeRange = 'day' | 'week';

const PromoVideoAnalyticsPanel = () => {
  const [analytics, setAnalytics] = useState<VideoAnalytics[]>([]);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('day');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

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

      // Build time series data
      const now = new Date();
      let timeData: TimeSeriesData[] = [];

      if (timeRange === 'day') {
        // Last 14 days
        const days = eachDayOfInterval({
          start: subDays(now, 13),
          end: now
        });

        timeData = days.map(day => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          
          const dayViews = viewsData?.filter(v => {
            const viewDate = new Date(v.viewed_at);
            return viewDate >= dayStart && viewDate <= dayEnd;
          }) || [];

          return {
            date: format(day, 'dd/MM', { locale: ptBR }),
            views: dayViews.length,
            completions: dayViews.filter(v => v.completed).length
          };
        });
      } else {
        // Last 8 weeks
        const weeks = eachWeekOfInterval({
          start: subWeeks(now, 7),
          end: now
        }, { weekStartsOn: 0 });

        timeData = weeks.map(weekStart => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
          
          const weekViews = viewsData?.filter(v => {
            const viewDate = new Date(v.viewed_at);
            return viewDate >= weekStart && viewDate <= weekEnd;
          }) || [];

          return {
            date: `Sem ${format(weekStart, 'dd/MM', { locale: ptBR })}`,
            views: weekViews.length,
            completions: weekViews.filter(v => v.completed).length
          };
        });
      }

      setTimeSeriesData(timeData);
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

      {/* Time Series Chart */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-primary" />
              Visualizações ao Longo do Tempo
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={timeRange === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('day')}
              >
                Por Dia
              </Button>
              <Button
                variant={timeRange === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('week')}
              >
                Por Semana
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {timeSeriesData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado disponível ainda
            </p>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="views" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Visualizações"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completions" 
                    stroke="hsl(142 71% 45%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(142 71% 45%)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Completas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

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
