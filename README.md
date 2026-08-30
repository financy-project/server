# Financy — Server

Financy é uma aplicação de finanças pessoais. Este repositório é o **backend**: uma API GraphQL que permite a usuários autenticados controlar suas finanças — cadastrando categorias e (em features futuras) lançando e classificando transações.

## Stack

- **Apollo Server** + **TypeGraphQL** — schema GraphQL construído a partir de resolvers decorados em TypeScript
- **Prisma** — ORM sobre PostgreSQL
- **Jest** — testes unitários, de integração (repositório real) e e2e (operações GraphQL reais contra o schema)
- **Docker Compose** — um Postgres isolado por ambiente (dev, integration, e2e)

A arquitetura segue **Function-First DDD**: toda a lógica de negócio é escrita como objetos const de funções puras, com quatro exceções explícitas onde o framework exige classes (entidades, erros de domínio, tipos GraphQL e resolvers). Veja [constitution.md](constitution.md) para os princípios completos e [docs/architecture/](docs/architecture/README.md) para os padrões práticos.

## Domínio

O projeto é conduzido por **Spec Driven Development** — cada funcionalidade nasce de uma especificação em `docs/features/PM-NNN-slug/spec.md` antes de qualquer código. Funcionalidades entregues até o momento:

- **[PM-001 — Cadastro de usuário](docs/features/PM-001-cadastro-usuario/spec.md)**: auto-cadastro (nome, email, senha) sem verificação por email; senha sempre hasheada.
- **[PM-002 — Login](docs/features/PM-002-login/spec.md)**: autenticação por email/senha, sessão via JWT em cookie `HttpOnly`, resposta de erro idêntica para email inexistente ou senha errada (timing-safe).
- **[PM-003 — Categorias](docs/features/PM-003-categorias/spec.md)**: usuário autenticado cria, lista, edita e apaga suas próprias categorias de transação (título, descrição, ícone, cor); categorias são estritamente isoladas por usuário.

Cada categoria de transação pertence a um único usuário e servirá, em uma feature futura, para classificar as transações financeiras que ele lançar.

## Rodando o projeto

```bash
pnpm install
pnpm dev                # sobe o Postgres de dev via Docker e inicia o Apollo Server com reload
```

```bash
pnpm build               # compila para dist/
pnpm test                # testes unitários
pnpm test:integration    # testes de repositório contra Postgres real (Docker)
pnpm test:e2e             # testes contra o schema GraphQL real (Docker)
pnpm lint                # eslint + prettier --check
```

Veja [CLAUDE.md](CLAUDE.md) para o guia operacional completo (comandos, convenções de teste, workflow de features).

## Fora de escopo (por enquanto)

- Lançamento e listagem de transações (feature futura, que consumirá as categorias)
- Login social, 2FA, recuperação de senha
- Categorias padrão/pré-cadastradas ou compartilhamento entre usuários
