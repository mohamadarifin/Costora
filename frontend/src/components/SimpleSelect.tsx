import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Opt { value: string; label: string }

export default function SimpleSelect({ value, onChange, options, testId, className, disabled }: {
  value: string; onChange: (v: string) => void; options: Opt[]; testId: string; className?: string; disabled?: boolean;
}) {
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select value={value} onValueChange={(v: string) => onChange(v)} disabled={disabled}>
      <SelectTrigger data-testid={testId} className={cn("h-9 min-w-36 bg-card", className)}>
        <SelectValue>{(v: unknown) => labels[v as string] ?? "Pilih..."}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} data-testid={`${testId}-opt-${o.value}`}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
