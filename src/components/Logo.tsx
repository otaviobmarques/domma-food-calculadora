export function Logo({ size = 28, light = false }: { size?: number; light?: boolean }) {
  const text = light ? "#fff" : "#1d1b3a";
  return (
    <span className="logo" aria-label="Domma Tecnologia" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width={size * 1.35} height={size} viewBox="0 0 54 40" aria-hidden>
        <defs>
          <linearGradient id="dg" x1="0" x2="1">
            <stop offset="0" stopColor="#6d4dff" />
            <stop offset="1" stopColor="#3f8cff" />
          </linearGradient>
        </defs>
        <path d="M5 31 Q14 10 22 26 Q30 42 38 22 Q43 10 49 18" fill="none" stroke="url(#dg)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="25" cy="8" r="4.5" fill="#1d1b3a" />
      </svg>
      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1 }}>
        <b style={{ fontSize: size * 0.78, color: text, letterSpacing: -0.5 }}>Domma</b>
        <small style={{ fontSize: size * 0.24, color: "#6d4dff", letterSpacing: 2.5, fontWeight: 800, textAlign: "right" }}>TECNOLOGIA</small>
      </span>
    </span>
  );
}
