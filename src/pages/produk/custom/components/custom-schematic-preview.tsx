import type { RoomDimensionsInput } from '../../../../types/cart';

export interface CustomSchematicPreviewProps {
  dimensions: RoomDimensionsInput | null;
  itemLabel: string;
  colorName: string;
  colorHex: string;
}

export function CustomSchematicPreview({
  dimensions,
  itemLabel,
  colorName,
  colorHex,
}: CustomSchematicPreviewProps) {
  const lengthCm = dimensions?.normalizedLengthCm ?? 300;
  const widthCm = dimensions?.normalizedWidthCm ?? 250;
  const ratio = Math.max(0.45, Math.min(2.2, lengthCm / Math.max(widthCm, 1)));

  const boxWidth = ratio >= 1 ? 190 : Math.round(190 * ratio);
  const boxHeight = ratio >= 1 ? Math.round(190 / ratio) : 190;
  const boxX = Math.round((260 - boxWidth) / 2);
  const boxY = Math.round((220 - boxHeight) / 2);

  return (
    <div className="pt-5 border-t lg:ml-8 border-[var(--border)] space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">Skema Proporsi Ruang</span>
        <span>Ilustrasi Awal</span>
      </div>

      <div className="w-full flex items-center justify-center py-2">
        <svg
          viewBox="0 0 260 220"
          className="w-full max-w-[260px] h-auto"
          role="img"
          aria-label={`Skema ilustratif proporsi untuk ${itemLabel} dengan warna ${colorName}`}
        >
          <rect
            x={boxX}
            y={boxY}
            width={boxWidth}
            height={boxHeight}
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <rect
            x={boxX + 12}
            y={boxY + 12}
            width={Math.max(24, Math.round(boxWidth * 0.56))}
            height={Math.max(18, Math.round(boxHeight * 0.34))}
            rx="2"
            fill={colorHex}
            stroke="var(--border-strong)"
            strokeWidth="1"
          />
          <text
            x="130"
            y={boxY + boxHeight + 18}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="10"
          >
            {dimensions
              ? `${dimensions.length} × ${dimensions.width} ${dimensions.unit}`
              : 'Menunggu ukuran valid'}
          </text>
        </svg>
      </div>

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        Ilustrasi skematis ini membantu memvisualisasikan perbandingan bidang dan warna secara kasar.
        Bukan gambar teknis CAD maupun jaminan kesesuaian lapangan.
      </p>
    </div>
  );
}
