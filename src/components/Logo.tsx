/** Marca Domma Food. `dark` = versão para fundo escuro (texto branco). */
export function Logo({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="logo"
      src={dark ? "/brand/domma-food-logo-dark.svg" : "/brand/domma-food-logo.svg"}
      alt="Domma Food"
      height={size}
      style={{ height: size, width: "auto", display: "block" }}
    />
  );
}

/** Só o símbolo (onda + pin), para espaços pequenos. */
export function LogoMark({ size = 28, color = "#EA1D2C", pin = "#1E1033" }: { size?: number; color?: string; pin?: string }) {
  return (
    <svg width={size * 1.75} height={size} viewBox="20 40 610 340" aria-label="Domma Food" role="img">
      <path d="M60 245 C 108 160, 138 128, 168 128 C 200 128, 226 172, 260 248 C 290 312, 306 332, 330 332 C 354 332, 372 310, 402 248 C 438 172, 464 128, 493 128 C 522 128, 548 162, 588 248" fill="none" stroke={color} strokeWidth="70" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M232 70 H268 M214 102 H262 M236 134 H268" stroke={color} strokeWidth="14" strokeLinecap="round" />
      <path d="M330 195.5 C 304.7 154.1, 284 131.1, 284 92 A 46 46 0 1 1 376 92 C 376 131.1, 355.3 154.1, 330 195.5 Z" fill={pin} />
      <circle cx="330" cy="92" r="19.32" fill="#fff" />
    </svg>
  );
}
