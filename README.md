# Calculadora iFood · Domma Food

**No ar:** https://domma-calculadora-ifood-redbox6.vercel.app · Supabase `domma-calculadora-ifood` (sa-east-1) · Vercel `domma-calculadora-ifood` (REDBOX)

PWA (Next.js + Supabase) que calcula quanto cobrar em cada item no iFood, Keeta, 99Food e aiqfome.

## Rodar local

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes das regras de cálculo (exemplos do descritivo)
```

Sem variáveis de ambiente, o app abre em **modo demonstração**: qualquer e-mail entra, os dados ficam no navegador
e o usuário vê o Painel Domma (`/painel`). Abra o app e o painel em duas abas: ao publicar uma tabela no painel,
a outra aba recebe a atualização sozinha.

## Telas

| Rota | Tela |
|---|---|
| `/login`, `/cadastro`, `/recuperar-senha` | Entrar / criar conta (nome do restaurante, e-mail, senha) / Google |
| `/` | Início: selo "Taxas em dia" (fica amarelo quando há tabela nova), atalho, resumo das taxas, alerta do cardápio |
| `/calcular` | Quanto cobrar? / Quanto recebo?, pagamento online, cupom, 4 cards com selo Menor preço / Mais lucro |
| `/cardapio`, `/cardapio/novo` | Cardápio com Ok/Revisar, Recalcular cardápio, novo item com prévia "suba para R$ X" |
| `/taxas` | Plano, contrato próprio, **Buscar atualização de taxas** |
| `/painel` | Painel Domma: publicar nova versão, rascunho, vigência futura, fonte obrigatória, histórico, verificar sites |

## Como as taxas se atualizam

1. As taxas ficam na tabela **`fee_versions`** (Supabase), uma linha por app e versão, com planos, fonte, data de vigência e status rascunho/publicada. Nada fica fixo no código.
2. A equipe publica pelo `/painel`. Uma versão com "vale a partir de" no futuro só entra em vigor nessa data.
3. **Automático:** o app do cliente escuta a tabela pelo Supabase Realtime e também confere quando volta para a tela e a cada 5 minutos. Quem usa a tabela oficial passa a usar a versão nova na hora e vê o aviso amarelo para recalcular o cardápio.
4. **Manual:** o botão **Buscar atualização de taxas** consulta na hora, mostra o que mudou e pede confirmação (com recálculo do cardápio).
5. Quem marcou "Meu contrato tem taxas diferentes" **não é alterado**: recebe o aviso e decide.
6. **Rotina diária** (`vercel.json` → `/api/cron/check-sources`, 08:00 de Brasília): baixa as páginas públicas marcadas em `fee_sources` (`auto_check = true`), tira uma "impressão digital" dos percentuais e valores em R$ e registra em `source_checks`. Se mudou, alerta a equipe (webhook opcional em `TEAM_ALERT_WEBHOOK_URL`) e o painel mostra "Mudança detectada". Keeta e aiqfome não publicam tabela, então ficam com conferência manual.

## Colocar no ar

1. Crie um projeto no Supabase e rode `supabase/migrations/20261110000000_init.sql` no SQL Editor (cria tabelas, segurança RLS, Realtime e a tabela nov/2026).
2. Em Authentication, ative o provedor Google (opcional) e cadastre a URL do site em *Redirect URLs*.
3. Crie sua conta pelo app e torne-a admin:
   ```sql
   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'seu@email.com');
   ```
4. Na Vercel, configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET` (e opcional `TEAM_ALERT_WEBHOOK_URL`) e faça o deploy.
   O hash SHA-256 do `CRON_SECRET` fica em `private.app_config` (chave `cron_secret_sha256`); as funções `get_fee_sources` e `record_source_check` só aceitam admin logado ou esse segredo. Não é preciso a chave service role.

> Os links de fonte de Keeta, 99Food e aiqfome na tabela inicial apontam para a página inicial dos veículos citados no descritivo. Troque pelos links exatos das matérias no painel.

Ferramenta independente, sem vínculo com iFood, Keeta, 99Food ou aiqfome.
