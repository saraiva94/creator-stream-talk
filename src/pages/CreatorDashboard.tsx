import DashboardSummaryCards from "@/components/creator/dashboard/DashboardSummaryCards";
import DashboardCharts from "@/components/creator/dashboard/DashboardCharts";
import DashboardTables from "@/components/creator/dashboard/DashboardTables";
import DashboardFilters from "@/components/creator/dashboard/DashboardFilters";
import { useCreatorDashboard } from "@/hooks/useCreatorDashboard";

const CreatorDashboard = () => {
  const { range, setRange, summary, chart, topLives, isLoading } = useCreatorDashboard();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Painel do Criador</h1>
            <p className="text-muted-foreground text-sm">Dados mockados para validar UX.</p>
          </div>
          <DashboardFilters range={range} onChange={setRange} />
        </div>

        <DashboardSummaryCards summary={summary} isLoading={isLoading} />

        <DashboardCharts data={chart} isLoading={isLoading} />

        <DashboardTables lives={topLives} />
      </main>
    </div>
  );
};

export default CreatorDashboard;
