import HistoryFilters from "@/components/creator/history/HistoryFilters";
import HistoryTable from "@/components/creator/history/HistoryTable";
import HistoryCharts from "@/components/creator/history/HistoryCharts";
import { useCreatorHistory } from "@/hooks/useCreatorHistory";

const CreatorHistory = () => {
  const { range, setRange, entries, isLoading } = useCreatorHistory();

  const chartData = entries.map((entry) => ({
    date: entry.date.slice(0, 10),
    revenue: entry.revenue,
  }));

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Histórico</h1>
            <p className="text-muted-foreground text-sm">Dados fictícios para validação.</p>
          </div>
          <HistoryFilters range={range} onChange={setRange} />
        </div>

        <HistoryTable entries={entries} />

        <HistoryCharts data={chartData} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default CreatorHistory;
