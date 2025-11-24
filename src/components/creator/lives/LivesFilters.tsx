import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  status: "all" | "draft" | "scheduled" | "live" | "ended";
  onStatusChange: (status: Props["status"]) => void;
  search: string;
  onSearchChange: (value: string) => void;
};

const LivesFilters = ({ status, onStatusChange, search, onSearchChange }: Props) => {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-2 w-full md:w-auto">
        <Select value={status} onValueChange={(val) => onStatusChange(val as Props["status"])}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="live">Ao vivo</SelectItem>
            <SelectItem value="ended">Encerradas</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar título"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full md:w-64"
        />
      </div>
    </div>
  );
};

export default LivesFilters;
