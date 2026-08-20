# Struktur Folder Proyek

## 1. Root Repository

```text
ticketing-sla/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── contracts/
│   ├── eslint-config/
│   └── tsconfig/
├── docs/
├── infra/
├── scripts/
├── .github/
├── .env.example
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── CHANGELOG.md
```

Monorepo direkomendasikan agar frontend, backend, dan shared API contract menggunakan TypeScript yang konsisten. Bila tim memilih repository terpisah, struktur internal setiap aplikasi tetap sama.

## 2. Frontend — `apps/web`

```text
apps/web/
├── public/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── query-client.ts
│   ├── api/
│   │   ├── http-client.ts
│   │   └── generated/
│   ├── assets/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── data-display/
│   │   └── feedback/
│   ├── features/
│   │   ├── auth/
│   │   ├── public-ticket/
│   │   ├── public-tracking/
│   │   ├── technician-registration/
│   │   ├── technician-approval/
│   │   ├── dashboard/
│   │   ├── tickets/
│   │   ├── assignments/
│   │   ├── field-operations/
│   │   ├── sla/
│   │   ├── notifications/
│   │   └── reports/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   │   ├── public/
│   │   ├── technician/
│   │   └── internal/
│   ├── routes/
│   ├── store/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/
│   └── e2e/
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Aturan Frontend

- `pages` hanya menyusun page-level layout.
- Logic domain berada di `features`.
- API type dihasilkan dari OpenAPI bila memungkinkan.
- Jangan menyimpan access-control hanya di route guard UI; backend tetap sumber kebenaran.
- Server state menggunakan query cache; hindari menyalin semua response ke global store.

## 3. Backend — `apps/api`

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── auth.config.ts
│   │   ├── database.config.ts
│   │   ├── media.config.ts
│   │   └── validation.ts
│   ├── common/
│   │   ├── constants/
│   │   ├── decorators/
│   │   ├── exceptions/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── types/
│   │   └── utils/
│   ├── database/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   └── transaction.service.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── access-control/
│   │   ├── technicians/
│   │   ├── clients/
│   │   ├── sites/
│   │   ├── ticket-catalog/
│   │   ├── tickets/
│   │   ├── assignments/
│   │   ├── field-operations/
│   │   ├── sla/
│   │   ├── media/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── audit/
│   │   └── health/
│   └── generated/
├── test/
│   ├── factories/
│   ├── integration/
│   └── e2e/
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

## 4. Struktur Module NestJS

Contoh `tickets`:

```text
modules/tickets/
├── tickets.module.ts
├── controllers/
│   ├── public-tickets.controller.ts
│   └── internal-tickets.controller.ts
├── services/
│   ├── create-ticket.service.ts
│   ├── respond-ticket.service.ts
│   ├── transition-ticket.service.ts
│   └── ticket-query.service.ts
├── domain/
│   ├── ticket-status.ts
│   ├── ticket-state-machine.ts
│   ├── ticket.policy.ts
│   └── ticket.errors.ts
├── dto/
│   ├── create-ticket.dto.ts
│   ├── respond-ticket.dto.ts
│   └── ticket-query.dto.ts
├── repositories/
│   └── ticket.repository.ts
├── mappers/
│   └── ticket.mapper.ts
└── tests/
    ├── ticket-state-machine.spec.ts
    └── respond-ticket.service.spec.ts
```

### Aturan Module

- Satu file service per use case penting lebih disarankan daripada satu service raksasa.
- DTO request dan response dipisahkan bila bentuknya berbeda.
- State machine dan calculator merupakan pure logic agar mudah diuji.
- Prisma model tidak langsung dikembalikan ke API; gunakan mapper/response DTO.
- Query report kompleks ditempatkan pada report repository/query service.

## 5. Shared Contracts — `packages/contracts`

```text
packages/contracts/
├── src/
│   ├── enums/
│   ├── api/
│   └── index.ts
├── package.json
└── tsconfig.json
```

Hanya bagikan kontrak stabil seperti enum publik atau generated API client. Jangan membagikan entity database atau internal domain model ke frontend.

## 6. Infrastructure

```text
infra/
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
├── nginx/
│   └── default.conf
├── compose/
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
├── monitoring/
└── backup/
```

## 7. Documentation

```text
docs/
├── PRD.md
├── Roadmap.md
├── Architecture.md
├── Project-Structure.md
├── Roles-Permissions.md
├── Ticket-Workflow.md
├── SLA-Specification.md
├── Data-Model.md
├── API-Specification.md
├── Security-Privacy.md
├── Reporting-Specification.md
├── Testing-UAT.md
├── Deployment-Runbook.md
├── Migration-to-NestJS.md
├── Glossary.md
└── adr/
    └── ADR-001-NestJS-Modular-Monolith.md
```

## 8. Naming Convention

- Folder dan file TypeScript: `kebab-case`.
- Class: `PascalCase`.
- Function/variable: `camelCase`.
- Database table: `snake_case` melalui mapping Prisma bila diperlukan.
- Enum database dan domain: uppercase snake case.
- Endpoint: plural noun dan kebab-case.
- Timestamp: akhiran `_at`.
- Boolean: awalan `is_`, `has_`, atau `can_`.
