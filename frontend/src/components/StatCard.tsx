import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "warning" | "critical";
  /** Si se pasa, la tarjeta es clickeable (ej: abre el detalle). */
  onClick?: () => void;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-primary",
  warning: "text-stock-low",
  critical: "text-stock-critical",
};

export function StatCard({ icon: Icon, label, value, tone = "default", onClick }: StatCardProps) {
  const contenido = (
    <>
      <div className={`mb-3 flex items-center gap-2 text-sm font-medium ${toneClasses[tone]}`}>
        <Icon size={18} />
        <span>{label}</span>
        {onClick && <ChevronRight size={16} className="ml-auto text-on-surface-variant" />}
      </div>
      <p className="font-data text-2xl font-semibold text-on-surface">{value}</p>
    </>
  );
  const clases = "rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm";

  if (!onClick) return <div className={clases}>{contenido}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${clases} w-full text-left transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
    >
      {contenido}
    </button>
  );
}
