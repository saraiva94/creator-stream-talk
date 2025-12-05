import { Button } from "@/components/ui/button";
import { type PixWithdrawalStatus } from "@/lib/pixWithdrawalsService";

type Props = {
  value: PixWithdrawalStatus | "all";
  onChange: (value: PixWithdrawalStatus | "all") => void;
  onReset: () => void;
};

const filters: { label: string; value: PixWithdrawalStatus | "all" }[] = [
  { label: "Pendentes", value: "pending" },
  { label: "Aprovados", value: "approved" },
  { label: "Rejeitados", value: "rejected" },
  { label: "Concluídos", value: "completed" },
  { label: "Todos", value: "all" },
];

const PixWithdrawalFilters = ({ value, onChange, onReset }: Props) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          size="sm"
          variant={value === filter.value ? "default" : "outline"}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
      <Button size="sm" variant="ghost" onClick={onReset} className="ml-auto">
        Resetar
      </Button>
    </div>
  );
};

export default PixWithdrawalFilters;
