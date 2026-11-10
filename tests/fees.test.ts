import { test } from "node:test";
import assert from "node:assert/strict";
import { priceFor, netFor, totalRate, breakdown, pickCurrent, diffVersions, SEED_VERSIONS } from "../src/lib/fees.ts";
import type { FeeVersion } from "../src/lib/types.ts";

test("exemplos do descritivo (receber R$ 25,00)", () => {
  assert.equal(priceFor(25, totalRate(12, 3.2)), 29.48); // iFood Básico
  assert.equal(priceFor(25, totalRate(9, 3.2)), 28.47); // Keeta
  assert.equal(priceFor(25, totalRate(0, 3.2)), 25.83); // 99Food campanha
  assert.equal(priceFor(25, totalRate(10, 3.2)), 28.8); // aiqfome
});

test("decomposição R$ 29,48 no Básico", () => {
  const b = breakdown(29.48, 12, 3.2);
  assert.equal(b.commissionValue, 3.54);
  assert.equal(b.onlineValue, 0.94);
  assert.equal(b.net, 25);
});

test("novo item: X-Burguer", () => {
  const r = totalRate(12, 3.2);
  assert.equal(priceFor(28, r), 33.02);
  assert.equal(netFor(32.9, r), 27.9);
});

test("pagamento na entrega não cobra taxa online", () => {
  assert.equal(totalRate(12, 3.2, false), 0.12);
});

test("cupom bancado pela loja sobe o preço de tabela", () => {
  const p = priceFor(25, totalRate(12, 3.2), 10);
  assert.equal(p, 32.76);
  assert.ok(Math.abs(netFor(p, totalRate(12, 3.2), 10) - 25) < 0.01);
});

test("versão em vigor respeita data de vigência", () => {
  const base = { ...SEED_VERSIONS[0], id: "a", created_at: "2026-11-10" } as FeeVersion;
  const future = { ...base, id: "b", valid_from: "2026-12-01", label: "dez/2026" };
  assert.equal(pickCurrent([base, future], "ifood", "2026-11-20")?.id, "a");
  assert.equal(pickCurrent([base, future], "ifood", "2026-12-01")?.id, "b");
  const changed = { ...future, plans: future.plans.map((p) => (p.key === "basico" ? { ...p, commission: 13 } : p)) };
  assert.deepEqual(diffVersions(base, changed), [{ field: "Comissão Básico", from: "12%", to: "13%" }]);
});
