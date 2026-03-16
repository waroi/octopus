interface Payload {
  value?: number;
  name?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
  formatter?: (value: number, name: string) => [string | number, string];
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry: Payload, i: number) => {
        const [displayValue, displayName] = formatter
          ? formatter(entry.value as number, entry.name ?? "")
          : [entry.value, entry.name];
        return (
          <p key={i}>
            {displayName} : {displayValue}
          </p>
        );
      })}
    </div>
  );
}
