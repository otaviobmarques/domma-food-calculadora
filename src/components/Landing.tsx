"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./AppProvider";
import { Logo, LogoMark } from "./Logo";
import { MoneyInput } from "./MoneyInput";
import { pickCurrent, priceFor, SEED_VERSIONS, totalRate } from "@/lib/fees";
import { dateBR, money, pct } from "@/lib/format";
import { APPS, type AppId, type FeeVersion } from "@/lib/types";

const SEED: FeeVersion[] = SEED_VERSIONS.map((v, i) => ({ ...v, id: `seed-${i}`, created_at: v.published_at! }));

/** Liga a classe .in quando o elemento entra na tela (animações de entrada). */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".lp .reveal"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/** Número que "corre" até o valor quando muda. */
function CountUp({ value, format = (n: number) => money(n), duration = 650 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(); const a = from.current; const b = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !isFinite(a) || !isFinite(b)) { setShown(b); from.current = b; return; }
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/** Conta só quando aparece na tela. */
function CountOnView({ to, format }: { to: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setV(to); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}><CountUp value={v} format={format} duration={1200} /></span>;
}

const NICHES = ["Hamburguerias", "Pizzarias", "Marmitarias", "Açaiterias", "Docerias", "Lanchonetes", "Comida japonesa", "Restaurantes", "Padarias", "Dark kitchens", "Pastelarias", "Comida saudável"];

const FAQ = [
  { q: "A calculadora é do iFood?", a: "Não. É uma ferramenta independente da Domma Food, sem vínculo com iFood, Keeta, 99Food ou aiqfome. Por isso ela compara os quatro lado a lado, sem puxar sardinha para ninguém." },
  { q: "De onde vêm as taxas?", a: "A tabela do iFood segue os valores públicos (Plano Básico e Plano Entrega). Keeta, 99Food e aiqfome não publicam tabela fixa, então usamos estimativas de fontes públicas, sempre marcadas com o selo “Estimativa”. Se o seu contrato tem outro percentual, é só informar e o cálculo passa a usar o seu." },
  { q: "E quando o iFood mudar as taxas?", a: "A equipe Domma confere as tabelas e publica a versão nova. Seu app recebe na hora, mostra exatamente o que mudou e avisa para recalcular o cardápio. Você também pode tocar em “Buscar atualização” quando quiser." },
  { q: "Preciso instalar alguma coisa?", a: "Não. Funciona no navegador do celular e do computador. Se quiser, adicione à tela inicial e ele abre como um aplicativo." },
  { q: "A mensalidade do iFood entra na conta?", a: "Não entra no preço por item, porque ela é fixa no mês e só é cobrada acima de R$ 1.800 em vendas. Ela aparece como informação na tela de taxas, para você não ser pego de surpresa." },
  { q: "Funciona com cupom e pagamento na entrega?", a: "Sim. Se o cliente paga em dinheiro na entrega, a taxa de pagamento online sai da conta. E se você banca um cupom, a calculadora sobe o preço de tabela para compensar o desconto." },
];

export function Landing() {
  const { store, user } = useApp();
  const [fees, setFees] = useState<FeeVersion[]>(SEED);
  const [value, setValue] = useState<number | null>(25);
  const [scrolled, setScrolled] = useState(false);
  const [sales, setSales] = useState(30000);
  const [plan, setPlan] = useState<"basico" | "entrega">("basico");
  const [open, setOpen] = useState<number | null>(0);
  useReveal();

  useEffect(() => { store.listPublishedFees().then((l) => { if (l.length) setFees(l); }).catch(() => {}); }, [store]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const current = useMemo(() => Object.fromEntries(APPS.map((a) => [a.id, pickCurrent(fees, a.id)])) as Record<AppId, FeeVersion | null>, [fees]);
  const ifood = current.ifood;
  const basico = ifood?.plans.find((p) => p.key === "basico") ?? ifood?.plans[0];
  const entrega = ifood?.plans.find((p) => p.key === "entrega") ?? ifood?.plans[1];
  const rateB = basico ? totalRate(basico.commission, basico.online) : 0.152;
  const rateE = entrega ? totalRate(entrega.commission, entrega.online) : 0.262;

  const demo = APPS.map((a) => {
    const v = current[a.id]; const p = v?.plans[0];
    const rate = p ? totalRate(p.commission, p.online) : 0;
    return { ...a, plan: p, rate, price: priceFor(value ?? 0, rate), kind: v?.kind };
  });
  const best = (value ?? 0) > 0 ? demo.reduce((b, c) => (c.price < b.price ? c : b)) : null;

  // Exemplo do erro comum (somar a taxa em cima do preço do balcão)
  const B = 25;
  const naive = B * (1 + rateB);
  const naiveNet = naive * (1 - rateB);
  const right = priceFor(B, rateB);

  // Simulador: faturamento no iFood com a conta errada → quanto escapa
  const r = plan === "basico" ? rateB : rateE;
  const lossMonth = (sales * r * r) / (1 + r);

  const ctaHref = user ? "/inicio" : "/cadastro";
  const ctaText = user ? "Abrir minha calculadora" : "Calcular meu preço grátis";

  return (
    <div className="lp">
      <header className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-wrap row between">
          <Link href="/" aria-label="Domma Food"><Logo size={34} /></Link>
          <nav className="lp-links">
            <a href="#problema">O erro</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#perguntas">Perguntas</a>
          </nav>
          <div className="row" style={{ gap: 10 }}>
            {!user && <Link href="/login" className="lp-login">Entrar</Link>}
            <Link href={ctaHref} className="btn primary small lp-shine">{user ? "Abrir app" : "Começar grátis"}</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-blob b1" /><div className="lp-blob b2" /><div className="lp-blob b3" />
        <svg className="lp-wave-bg" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden>
          <path d="M0 220 C 180 120, 300 90, 420 150 C 560 220, 640 300, 780 260 C 920 220, 980 80, 1120 90 C 1260 100, 1340 200, 1440 170" />
        </svg>
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-pill reveal"><span className="dot" /> Taxas {ifood?.label ?? "2026"} conferidas pela Domma</span>
            <h1 className="reveal" style={{ ["--d" as string]: "80ms" }}>
              Venda no iFood <span className="lp-hl">sem pagar a taxa</span> do seu bolso.
            </h1>
            <p className="lp-lead reveal" style={{ ["--d" as string]: "160ms" }}>
              Somar 15% no preço do balcão parece certo, mas não é. A Calculadora Domma Food mostra em segundos o preço exato de cada item
              no <b>iFood, Keeta, 99Food e aiqfome</b>, para você receber limpo o que cobra no balcão.
            </p>
            <div className="lp-cta-row reveal" style={{ ["--d" as string]: "240ms" }}>
              <Link href={ctaHref} className="btn primary lp-big lp-shine">{ctaText} <span aria-hidden>→</span></Link>
              <a href="#como-funciona" className="btn outline lp-big">Ver como funciona</a>
            </div>
            <ul className="lp-trust reveal" style={{ ["--d" as string]: "320ms" }}>
              <li>✓ Sem instalar nada</li><li>✓ Funciona no celular</li><li>✓ Avisa quando a taxa muda</li>
            </ul>
          </div>

          <div className="lp-phone-wrap reveal from-right" style={{ ["--d" as string]: "200ms" }}>
            <div className="lp-phone">
              <div className="lp-phone-top">
                <div><b>Calculadora</b><small>Quanto quer receber limpo?</small></div>
                <LogoMark size={18} color="#fff" pin="#fff" />
              </div>
              <div className="lp-phone-body">
                <MoneyInput big value={value} onChange={setValue} />
                <div className="lp-demo-grid">
                  {demo.map((d, i) => (
                    <div key={d.id} className={`lp-demo-card ${best?.id === d.id ? "best" : ""}`} style={{ ["--i" as string]: i }}>
                      {best?.id === d.id && <span className="lp-best">Menor preço</span>}
                      <div className="row between"><b>{d.name}</b><span className={`badge ${d.kind === "oficial" ? "ok" : "warn"}`}>{d.kind === "oficial" ? "Oficial" : "Estimativa"}</span></div>
                      <span className="lp-demo-price">{(value ?? 0) > 0 ? <CountUp value={d.price} /> : "—"}</span>
                      <span className="tiny muted">taxas {pct(d.rate * 100)}</span>
                    </div>
                  ))}
                </div>
                <p className="tiny muted center-text" style={{ margin: 0 }}>Digite um valor: é a calculadora de verdade.</p>
              </div>
            </div>
            <div className="lp-float f1"><span>✓</span> Recebe {money(value ?? 0)} limpo</div>
            <div className="lp-float f2"><span>⚠</span> O iFood mudou as taxas. Recalcule.</div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="lp-marquee" aria-label="Para quem é">
        <div className="lp-marquee-track">
          {[...NICHES, ...NICHES].map((n, i) => <span key={i}>{n}<i>•</i></span>)}
        </div>
      </div>

      {/* PROBLEMA */}
      <section id="problema" className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head reveal">
            <span className="eyebrow">O erro mais caro do delivery</span>
            <h2>A conta que quase todo restaurante faz errado</h2>
            <p>A taxa do app é cobrada sobre o <b>preço final</b>, não sobre o preço do balcão. Então somar a porcentagem em cima sempre deixa dinheiro na mesa, em todo pedido.</p>
          </div>
          <div className="lp-compare">
            <div className="lp-cmp wrong reveal from-left">
              <span className="lp-tag">✕ Do jeito comum</span>
              <p className="muted">Item de {money(B)} + {pct(rateB * 100)} de taxa</p>
              <div className="lp-cmp-big">{money(naive)}</div>
              <div className="lp-cmp-row"><span>Você recebe</span><b className="neg">{money(naiveNet)}</b></div>
              <div className="lp-cmp-row"><span>Perde por item</span><b className="neg">− {money(B - naiveNet)}</b></div>
            </div>
            <div className="lp-cmp-vs reveal">vs</div>
            <div className="lp-cmp right reveal from-right">
              <span className="lp-tag">✓ Com a Calculadora</span>
              <p className="muted">{money(B)} ÷ (1 − {pct(rateB * 100)})</p>
              <div className="lp-cmp-big">{money(right)}</div>
              <div className="lp-cmp-row"><span>Você recebe</span><b className="pos">{money(B)}</b></div>
              <div className="lp-cmp-row"><span>Perde por item</span><b className="pos">R$ 0,00</b></div>
            </div>
          </div>

          <div className="lp-sim reveal">
            <div className="lp-sim-copy">
              <h3>Parece pouco? Multiplica pelo mês.</h3>
              <p className="muted">Arraste e veja quanto escapa quando o cardápio é montado somando a taxa em cima do preço.</p>
              <div className="tabs" style={{ maxWidth: 360 }}>
                <button className={plan === "basico" ? "on" : ""} onClick={() => setPlan("basico")}>Plano Básico · {pct(rateB * 100)}</button>
                <button className={plan === "entrega" ? "on" : ""} onClick={() => setPlan("entrega")}>Plano Entrega · {pct(rateE * 100)}</button>
              </div>
              <label className="lp-range">
                <span>Vendas por mês no iFood: <b>{money(sales)}</b></span>
                <input type="range" min={5000} max={200000} step={1000} value={sales} onChange={(e) => setSales(Number(e.target.value))}
                  style={{ ["--p" as string]: `${((sales - 5000) / 195000) * 100}%` }} />
              </label>
            </div>
            <div className="lp-sim-result">
              <small>Dinheiro que fica no caminho</small>
              <div className="lp-sim-month"><CountUp value={lossMonth} /><span>/mês</span></div>
              <div className="lp-sim-year">≈ <CountUp value={lossMonth * 12} /> por ano</div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="lp-section alt">
        <div className="lp-wrap">
          <div className="lp-head reveal">
            <span className="eyebrow">Simples e direto</span>
            <h2>Uma pergunta. O preço certo na hora.</h2>
          </div>
          <div className="lp-steps">
            {[
              { n: "1", t: "Diga quanto quer receber", d: "Normalmente é o preço que você já cobra no balcão. Só isso." },
              { n: "2", t: "Veja o preço nos 4 apps", d: "iFood, Keeta, 99Food e aiqfome lado a lado, com o mais vantajoso em destaque." },
              { n: "3", t: "Salve no cardápio", d: "O app marca os itens que estão abaixo do ideal e diz exatamente quanto subir." },
            ].map((s, i) => (
              <div key={s.n} className="lp-step reveal" style={{ ["--d" as string]: `${i * 120}ms` }}>
                <span className="lp-step-n">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head reveal">
            <span className="eyebrow">Tudo o que importa, nada que atrapalhe</span>
            <h2>Feito para quem vive de delivery</h2>
          </div>
          <div className="lp-features">
            {[
              { i: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z", t: "4 apps lado a lado", d: "Compare iFood, Keeta, 99Food e aiqfome e descubra onde você ganha mais." },
              { i: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 4v5l4 2-1 1.7-5-2.7V7z", t: "Resultado a cada tecla", d: "Sem botão de calcular. Digitou, apareceu." },
              { i: "M4 6h16M4 12h16M4 18h10", t: "Cardápio com alerta", d: "Selo “Revisar” nos itens que fazem você receber menos do que queria." },
              { i: "M12 4v4m0 8v4M4 12h4m8 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8M6.3 17.7l2.8-2.8m5.8-5.8 2.8-2.8", t: "Taxas sempre em dia", d: "A Domma confere e publica. Seu app atualiza sozinho e avisa o que mudou." },
              { i: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3", t: "Seu contrato, suas taxas", d: "Negociou outro percentual? Informe uma vez e o cálculo passa a usar o seu." },
              { i: "M7 7h10l-1 12H8zM9 7a3 3 0 0 1 6 0", t: "Cupom e pagamento na entrega", d: "Banca um desconto ou recebe em dinheiro? A conta se ajusta." },
            ].map((f, k) => (
              <div key={f.t} className="lp-feature reveal" style={{ ["--d" as string]: `${(k % 3) * 100}ms` }}>
                <span className="lp-ico"><svg viewBox="0 0 24 24" width="24" height="24"><path d={f.i} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ATUALIZAÇÃO */}
      <section className="lp-section dark">
        <div className="lp-wrap lp-update">
          <div className="reveal from-left">
            <span className="eyebrow" style={{ color: "#ff7a84" }}>Atualização automática</span>
            <h2>O iFood mudou a taxa? <br />Você fica sabendo.</h2>
            <p>Nada de planilha desatualizada. As taxas ficam numa tabela central da Domma. Quando muda, o seu app recebe na hora, mostra o antes e o depois e recalcula o cardápio inteiro com um toque.</p>
            <ul className="lp-timeline">
              <li><span>1</span>A Domma confere as tabelas dos apps</li>
              <li><span>2</span>Publica a versão nova, com a fonte</li>
              <li><span>3</span>Seu app avisa e mostra o que mudou</li>
              <li><span>4</span>Você recalcula tudo com um toque</li>
            </ul>
          </div>
          <div className="lp-notif-stack reveal from-right">
            <div className="lp-notif n1"><b>Taxas novas publicadas</b><span>iFood · Comissão Básico <s>12%</s> → <b>13%</b></span></div>
            <div className="lp-notif n2"><b>Cardápio recalculado</b><span>18 itens com o preço novo</span></div>
            <div className="lp-notif n3"><b>✓ Taxas em dia</b><span>conferidas pela Domma em {dateBR(ifood?.published_at ?? ifood?.valid_from)}</span></div>
          </div>
        </div>
      </section>

      {/* NÚMEROS */}
      <section className="lp-section">
        <div className="lp-wrap lp-stats">
          <div className="reveal"><b><CountOnView to={4} format={(n) => String(Math.round(n))} /></b><span>apps comparados de uma vez</span></div>
          <div className="reveal" style={{ ["--d" as string]: "100ms" }}><b><CountOnView to={rateB * 100} format={(n) => pct(n)} /></b><span>de taxa total no Plano Básico do iFood com pagamento pelo app</span></div>
          <div className="reveal" style={{ ["--d" as string]: "200ms" }}><b><CountOnView to={3} format={(n) => `${Math.round(n)} s`} /></b><span>para saber o preço certo de um item</span></div>
        </div>
      </section>

      {/* FAQ */}
      <section id="perguntas" className="lp-section alt">
        <div className="lp-wrap lp-faq-wrap">
          <div className="lp-head reveal" style={{ textAlign: "left", margin: 0 }}>
            <span className="eyebrow">Perguntas frequentes</span>
            <h2>Ficou alguma dúvida?</h2>
            <p>Se não estiver aqui, crie sua conta e teste: em um minuto você já viu como funciona.</p>
          </div>
          <div className="lp-faq">
            {FAQ.map((f, i) => (
              <div key={f.q} className={`lp-q reveal ${open === i ? "open" : ""}`} style={{ ["--d" as string]: `${i * 60}ms` }}>
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  {f.q}<span className="lp-plus" aria-hidden />
                </button>
                <div className="lp-a"><div><p>{f.a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="lp-final">
        <div className="lp-blob b1" /><div className="lp-blob b2" />
        <div className="lp-wrap reveal">
          <h2>Seu próximo pedido já pode vir com o preço certo.</h2>
          <p>Crie sua conta, informe quanto quer receber e veja o preço em cada app. Leva menos tempo que montar uma marmita.</p>
          <Link href={ctaHref} className="btn white lp-big lp-shine">{ctaText} <span aria-hidden>→</span></Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap row between wrap" style={{ gap: 16 }}>
          <Logo size={30} dark />
          <p>Ferramenta independente, sem vínculo com iFood, Keeta, 99Food ou aiqfome. Taxas de Keeta, 99Food e aiqfome são estimativas.</p>
          <div className="row" style={{ gap: 16 }}><Link href="/login">Entrar</Link><Link href="/cadastro">Criar conta</Link></div>
        </div>
      </footer>
    </div>
  );
}
