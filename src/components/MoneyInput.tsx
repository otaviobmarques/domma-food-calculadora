"use client";
/** Campo em R$ estilo app de banco: digita os números e a vírgula se ajusta sozinha. */
export function MoneyInput({ value, onChange, big, placeholder, id, autoFocus }: {
  value: number | null; onChange: (v: number | null) => void; big?: boolean; placeholder?: string; id?: string; autoFocus?: boolean;
}) {
  const display = value == null ? "" : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className={`money ${big ? "money-big" : ""}`}>
      <span className="money-prefix">R$</span>
      <input
        id={id}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder ?? "0,00"}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
          onChange(digits ? Number(digits) / 100 : null);
        }}
      />
    </div>
  );
}
