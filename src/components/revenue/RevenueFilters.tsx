import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type RevenueRange } from "@/lib/platformRevenueService";

const options: { value: RevenueRange; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "lifetime", label: "Lifetime" },
];

type Props = {
  value: RevenueRange;
  onChange: (value: RevenueRange) => void;
};

const RevenueFilters = ({ value, onChange }: Props) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "outline"}
          size="sm"
          className={cn(value === option.value && "shadow-sm")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};

export default RevenueFilters;
