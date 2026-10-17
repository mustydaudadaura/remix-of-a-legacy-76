// Code 128 (Subset B) Pure SVG Barcode Generator
// Standard for Nigerian educational credentials, student admission numbers, and certificate validation

const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export interface BarcodeOptions {
  height?: number;
  barWidth?: number;
  showText?: boolean;
  className?: string;
  fillColor?: string;
}

function encodeCode128B(text: string): { widths: number[]; checksum: number; encodedChars: number[] } {
  const safeText = text || "SAMPLE";
  const charCodes: number[] = [];

  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      charCodes.push(code);
    } else {
      charCodes.push(0); // fallback space
    }
  }

  // Calculate checksum
  let sum = START_CODE_B;
  for (let i = 0; i < charCodes.length; i++) {
    sum += charCodes[i] * (i + 1);
  }
  const checksum = sum % 103;

  const sequence = [START_CODE_B, ...charCodes, checksum, STOP_CODE];
  const widths: number[] = [];

  for (const code of sequence) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let j = 0; j < pattern.length; j++) {
      widths.push(parseInt(pattern[j], 10));
    }
  }

  return { widths, checksum, encodedChars: sequence };
}

export function Barcode({
  value,
  height = 42,
  barWidth = 1.4,
  showText = true,
  className = "",
  fillColor = "currentColor",
}: {
  value: string;
} & BarcodeOptions) {
  const safeValue = value || "000000";
  const { widths } = encodeCode128B(safeValue);

  let totalModules = 0;
  for (const w of widths) {
    totalModules += w;
  }

  // Add quiet zones (10 modules each side)
  const quietZone = 10;
  const totalWidth = (totalModules + quietZone * 2) * barWidth;
  const svgHeight = height + (showText ? 14 : 0);

  // Generate rects
  let currentX = quietZone * barWidth;
  const rects: { x: number; w: number }[] = [];

  for (let i = 0; i < widths.length; i++) {
    const w = widths[i] * barWidth;
    const isBar = i % 2 === 0;
    if (isBar) {
      rects.push({ x: currentX, w });
    }
    currentX += w;
  }

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={totalWidth}
        height={svgHeight}
        viewBox={`0 0 ${totalWidth} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        shapeRendering="crispEdges"
      >
        <g fill={fillColor}>
          {rects.map((r, idx) => (
            <rect key={idx} x={r.x} y={0} width={r.w} height={height} />
          ))}
        </g>
        {showText && (
          <text
            x={totalWidth / 2}
            y={height + 11}
            textAnchor="middle"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="1"
            fill={fillColor}
            fontWeight="bold"
          >
            *{safeValue.toUpperCase()}*
          </text>
        )}
      </svg>
    </div>
  );
}
