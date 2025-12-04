import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useMemo } from "react";

type Props = {
  day: string;
  month: string;
  year: string;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
  disabled?: boolean;
};

const months = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export const DateOfBirthSelector = ({
  day,
  month,
  year,
  onDayChange,
  onMonthChange,
  onYearChange,
  disabled = false,
}: Props) => {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 100;
  const maxYear = currentYear - 18; // Must be at least 18 years old

  const years = useMemo(() => {
    const arr = [];
    for (let y = maxYear; y >= minYear; y--) {
      arr.push(y.toString());
    }
    return arr;
  }, [maxYear, minYear]);

  const days = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= 31; d++) {
      arr.push(d.toString().padStart(2, "0"));
    }
    return arr;
  }, []);

  return (
    <div className="space-y-2">
      <Label>Data de nascimento *</Label>
      <p className="text-xs text-muted-foreground mb-2">
        Você deve ter 18 anos completos para se cadastrar
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Select value={day} onValueChange={onDayChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={onMonthChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={year} onValueChange={onYearChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export const validateAge = (day: string, month: string, year: string): { valid: boolean; age: number } => {
  if (!day || !month || !year) {
    return { valid: false, age: 0 };
  }

  const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return { valid: age >= 18, age };
};
