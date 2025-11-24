import { Button } from "@/components/ui/button";

type Range = "7d" | "30d" | "90d" | "all";

type Props = {
  range: Range;
  onChange: (range: Range) => void;
};

const HistoryFilters = ({ range, onChange }: Props) => {
  const ranges: Range[] = ["7d", "30d", "90d", "all"];
  const labels: Record<Range, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", all: "Tudo" };

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

export default HistoryFilters;
