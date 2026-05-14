interface SparklineProps {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ values, width = 120, height = 36, color = "#8b5cf6" }: SparklineProps) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return <svg width={width} height={height} />;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const coords: Array<{ x: number; y: number } | null> = values.map((v, i) => {
    if (v === null) return null;
    return {
      x: i * step,
      y: height - ((v - min) / range) * (height - 6) - 3,
    };
  });

  // Build polyline segments split by nulls
  const segments: string[][] = [];
  let current: string[] = [];
  for (const pt of coords) {
    if (pt === null) {
      if (current.length > 1) segments.push(current);
      current = [];
    } else {
      current.push(`${pt.x},${pt.y}`);
    }
  }
  if (current.length > 1) segments.push(current);

  const nonNull = coords.filter((c): c is { x: number; y: number } => c !== null);
  const areaPath =
    nonNull.length >= 2
      ? `M ${nonNull[0].x},${height} L ${nonNull.map((p) => `${p.x},${p.y}`).join(" L ")} L ${nonNull[nonNull.length - 1].x},${height} Z`
      : "";

  const gradId = `g${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      {segments.map((pts, i) => (
        <polyline
          key={i}
          points={pts.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
