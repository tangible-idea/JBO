export default function Logo({ size = 34 }) {
  return (
    <svg viewBox="0 0 128 128" width={size} height={size} aria-hidden="true">
      <g stroke="#9a9588" strokeWidth="7" strokeLinecap="round">
        <line x1="8" y1="52" x2="26" y2="52" />
        <line x1="4" y1="68" x2="20" y2="68" />
        <line x1="12" y1="84" x2="26" y2="84" />
      </g>
      {["#18181a", "#c8f25a"].map((color, i) => (
        <polygon
          key={color}
          points="83.1,21.0 89.6,49.9 117.8,59.4 92.2,74.5 91.9,104.2 69.6,84.5 41.3,93.4 53.1,66.2 35.9,42.0 65.5,44.8"
          fill={color}
          stroke={color}
          strokeWidth={i === 0 ? 20 : 8}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
