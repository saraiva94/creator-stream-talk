import LivesFilters from "@/components/creator/lives/LivesFilters";
import LivesTable from "@/components/creator/lives/LivesTable";
import LivesCharts from "@/components/creator/lives/LivesCharts";
import { useCreatorLives } from "@/hooks/useCreatorLives";

const CreatorLives = () => {
  const { lives, status, setStatus, search, setSearch, isLoading } = useCreatorLives();

  const chartData = lives.map((live) => ({
    label: live.title.slice(0, 12),
    viewers: live.viewers,
  }));

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lives</h1>
            <p className="text-muted-foreground text-sm">Lista mockada para testes internos.</p>
          </div>
        </div>

        <LivesFilters status={status} onStatusChange={setStatus} search={search} onSearchChange={setSearch} />

        <LivesTable lives={lives} />

        <LivesCharts data={chartData} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default CreatorLives;
