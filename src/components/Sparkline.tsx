export function Sparkline({ values, max = 100, height = 48 }: { values: number[]; max?: number; height?: number }) {
  const w = 240
  if (values.length < 2) return <div style={{ height }} />
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (Math.min(v, max) / max) * (height - 4) - 2).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill="var(--accent)" opacity="0.12" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
