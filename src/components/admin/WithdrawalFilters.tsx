import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { type WithdrawalStatus } from "@/lib/withdrawalsService";

type Props = {
  value: WithdrawalStatus | "all";
  onChange: (value: WithdrawalStatus | "all") => void;
  onReset: () => void;
};

const WithdrawalFilters = ({ value, onChange, onReset }: Props) => {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filtrar por status</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={value} onValueChange={(val) => onChange(val as WithdrawalStatus | "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={onReset}>
          Limpar
        </Button>
      </div>
    </div>
  );
};

export default WithdrawalFilters;
