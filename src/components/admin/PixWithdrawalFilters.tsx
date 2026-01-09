import { Button } from "@/components/ui/button";
import { type PixWithdrawalStatus } from "@/lib/pixWithdrawalsService";
import { useLanguage } from "@/hooks/useLanguage";

type Props = {
  value: PixWithdrawalStatus | "all";
  onChange: (value: PixWithdrawalStatus | "all") => void;
};

const PixWithdrawalFilters = ({ value, onChange }: Props) => {
  const { t } = useLanguage();

  const filters: { label: string; value: PixWithdrawalStatus | "all" }[] = [
    { label: t.pixWithdrawals.pending, value: "pending" },
    { label: t.pixWithdrawals.approved, value: "approved" },
    { label: t.pixWithdrawals.rejected, value: "rejected" },
    { label: t.pixWithdrawals.completed, value: "completed" },
    { label: t.pixWithdrawals.all, value: "all" },
  ];

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
    </div>
  );
};

export default PixWithdrawalFilters;
