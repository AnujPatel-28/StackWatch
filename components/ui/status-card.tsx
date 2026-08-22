type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "teal" | "coral" | "ink" | "mint";
};

const toneStyles = { teal: "bg-teal", coral: "bg-coral", ink: "bg-ink", mint: "bg-mint" };

export function StatusCard({ label, value, detail, tone = "mint" }: StatusCardProps) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-5 shadow-soft">
      <div className="mb-8 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink/60">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${toneStyles[tone]}`} aria-hidden="true" />
      </div>
      <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink/55">{detail}</p>
    </article>
  );
}
