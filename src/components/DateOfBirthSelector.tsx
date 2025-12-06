import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useMemo } from "react";
import { useLanguage } from "@/hooks/useLanguage";

type Props = {
  day: string;
  month: string;
  year: string;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
  disabled?: boolean;
};

export const DateOfBirthSelector = ({
  day,
  month,
  year,
  onDayChange,
  onMonthChange,
  onYearChange,
  disabled = false,
}: Props) => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 100;
  const maxYear = currentYear - 18;

  const months = useMemo(() => {
    return t.subscribe.monthNames.map((label, index) => ({
      value: (index + 1).toString().padStart(2, "0"),
      label,
    }));
  }, [t.subscribe.monthNames]);

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
      <Label>{t.subscribe.dateOfBirth} *</Label>
      <p className="text-xs text-muted-foreground mb-2">
        {t.subscribe.dateOfBirthHint}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Select value={day} onValueChange={onDayChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder={t.subscribe.day} />
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
            <SelectValue placeholder={t.subscribe.month} />
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
            <SelectValue placeholder={t.subscribe.year} />
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