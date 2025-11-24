import { Button } from "@/components/ui/button";

type Props = {
  range: "7d" | "30d" | "90d";
  onChange: (range: "7d" | "30d" | "90d") => void;
};

const DashboardFilters = ({ range, onChange }: Props) => {
  const ranges: Props["range"][] = ["7d", "30d", "90d"];
  const labels: Record<Props["range"], string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias" };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ranges.map((r) => (
        <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => onChange(r)}>
          {labels[r]}
        </Button>
      ))}
    </div>
  );
};

export default DashboardFilters;
