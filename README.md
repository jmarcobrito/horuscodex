# Horus — Controle de Horas Técnicas

Aplicação de controle de horas, banco de horas e solicitações para prestadores
PJ e equipes de RH. O frontend roda com vinext/OpenAI Sites e os dados
persistentes ficam em um projeto Supabase PostgreSQL.

## Requisitos

- Node.js `>=22.13.0`
- um projeto Supabase
- Supabase CLI autenticada para aplicar migrações

## Configuração local

```bash
npm install
cp .env.example .env.local
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npm run db:push
npm run dev
```

Preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`. A chave
`service_role` é exclusiva do servidor: nunca use o prefixo `NEXT_PUBLIC_` e
nunca faça commit do valor real.

## Banco de dados

- as migrações PostgreSQL ficam em `supabase/migrations/`;
- o lançamento diário usa a função transacional `upsert_time_entry`;
- tabelas públicas têm RLS habilitado e não possuem políticas para `anon` ou
  `authenticated`;
- o backend acessa o banco com a chave `service_role`, armazenada como segredo
  no ambiente de produção;
- o acesso de cada usuário continua vinculado à identidade fornecida pelo Sites.

### Fechamento mensal seguro

- folgas e ausências de vários dias exigem horas explícitas para cada data;
- a pré-conferência oficial do banco separa meses prontos, pendentes e fechados;
- fechamento e reabertura são transacionais e usam uma versão de revisão para impedir decisões sobre dados desatualizados;
- inativar uma pessoa preserva o histórico; as rotas de exclusão operacional foram removidas;
- migrações de produção devem seguir o [runbook de liberação segura](docs/runbooks/supabase-safe-migration.md) e a [consulta agregada de reconciliação](supabase/tests/reconcile_production.sql).

As migrações desta entrega foram validadas em uma branch Supabase sem dados reais. Isso não autoriza aplicação em produção.

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: executa os testes de domínio, APIs, dashboard e interface
- `npm run db:push`: apply pending migrations to the linked Supabase project
- `npm run db:types`: regenerate TypeScript database types from Supabase

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase JavaScript client](https://supabase.com/docs/reference/javascript/initializing)
