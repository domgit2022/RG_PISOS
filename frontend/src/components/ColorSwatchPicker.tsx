import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { PALETA_COLORES_SUGERIDOS } from "@/constants/color-palette";

interface ColorSwatchPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function ColorSwatchPicker({ label, value, onChange }: ColorSwatchPickerProps) {
  const { t } = useTranslation();
  const valorNormalizado = value.toUpperCase();

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-on-surface">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PALETA_COLORES_SUGERIDOS.map((swatch) => {
          const seleccionado = swatch.hex === valorNormalizado;
          return (
            <button
              key={swatch.hex}
              type="button"
              title={swatch.nombre}
              onClick={() => onChange(swatch.hex)}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-105"
              style={{
                backgroundColor: swatch.hex,
                borderColor: seleccionado ? "var(--color-on-surface)" : "transparent",
              }}
            >
              {seleccionado && <Check size={16} className="text-white drop-shadow" />}
            </button>
          );
        })}
        <label
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dashed border-outline text-[10px] text-on-surface-variant"
          title={t("settings.customColor")}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="h-0 w-0 opacity-0"
          />
          +
        </label>
      </div>
    </div>
  );
}
