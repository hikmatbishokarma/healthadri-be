# healthadri-be — NestJS Backend

## Stack
NestJS 10, TypeScript, MongoDB (Mongoose), `@nestjs/jwt`, `bcryptjs`, `class-validator`, `class-transformer`, Sarvam AI (`sarvamai`)

---

## Module structure

Feature modules live **flat** in `/src/<feature>/` — there is no `/src/modules/` directory.

```
src/
  <feature>/
    <feature>.module.ts
    <feature>.controller.ts
    <feature>.service.ts
    <feature>.schema.ts        ← Mongoose schema + SchemaFactory
    dto/
      create-<feature>.dto.ts
      update-<feature>.dto.ts
  common/                      ← shared utilities, pipes, interceptors
  app.module.ts                ← registers all feature modules
  main.ts
```

### Current feature modules
`auth` · `users` · `symptoms` · `symptom-entry` · `alerts` · `playbooks` · `messages` · `hospitals` · `doctors` · `navigator` · `patients` · `triage` · `appointments` · `documents` · `document-processing` · `tasks` · `reports` · `ai`

---

## Auth

| Flow | Endpoint | Mechanism |
|------|----------|-----------|
| Patient / Navigator login | `POST /auth/send-otp` → `POST /auth/verify-otp` | Static OTP `1234` in dev |
| Super-admin login | `POST /auth/admin/login` | Email + bcrypt password |
| All flows return | `{ token, user }` | JWT payload: `{ sub, role }` |

- **No NestJS Guards are wired yet.** Controllers that need the caller's identity extract it manually from the `Authorization: Bearer <token>` header using `JwtService.verify()`.
- When adding new protected routes, follow the same manual pattern until a global guard is introduced.

---

## DTOs & Validation

- Use **`class-validator`** decorators — Zod is not installed.
- Every controller input must go through a typed DTO.
- A global `ValidationPipe` is registered in `main.ts`; it strips unknown fields (`whitelist: true`) and throws on extra properties.

Example decorator set for a string field:
```ts
@IsString()
@MinLength(2)
@MaxLength(120)
name: string;
```

---

## API Response Format

**Return raw data directly — no `{ success, data, message }` wrapper.**

```ts
// ✅ correct
return this.hospitalsService.findAll();   // returns Hospital[]

// ❌ wrong — do not wrap
return { success: true, data: hospitals, message: 'OK' };
```

Throw NestJS `HttpException` subclasses for errors (`NotFoundException`, `UnauthorizedException`, `BadRequestException`, etc.) — the framework serialises them consistently.

---

## Schemas

- Use `@Schema({ timestamps: true })` on every entity schema.
- Declare relations as `Types.ObjectId` with a `ref` option, and populate them explicitly in service methods where needed.
- Never store plain-text passwords — always hash with `bcryptjs` (cost factor 10).

---

## Seed Scripts

```bash
npx ts-node src/seed.ts             # full reset — drops DB and recreates all data
npx ts-node src/seed-hospitals.ts   # hospitals only
npx ts-node src/seed-symptoms.ts    # symptoms only
npx ts-node src/seed-appointments.ts
npx ts-node src/seed-symptom-entries.ts
```

`seed.ts` reads `MONGO_URI`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` from `.env`.

---

## AI (Sarvam AI)

The `ai` module wraps the `sarvamai` SDK. It provides:
- A medical explainer endpoint (`POST /ai/explain`) — classifies input as safe/abusive/non-medical and responds accordingly.
- TTS/STT utilities used by the mobile app.

The AI system prompt enforces strict rules: never diagnose, never suggest treatment or dosage. Output is always strict JSON `{ type, response }`.

---

## Roles Reference

| Role | Created via | Can use |
|------|------------|---------|
| `patient` | OTP first login (auto-creates) | Mobile API |
| `navigator` | Seeded or admin dashboard | Mobile API |
| `super-admin` | `seed.ts` / env vars | Admin dashboard |

Navigator provisioning is intentionally manual (seeded or dashboard-created). A self-registration flow for navigators is not implemented.

---

## Things to Know

- `patientCode` (`HA-<year>-<6digits>`) is auto-generated on patient creation — never set it manually.
- `assignedNavigatorId` on a patient points to the navigator responsible for them. New patients are auto-assigned to the first navigator found.
- The `triage` module scores incoming symptom entries and creates `Alert` documents when thresholds are exceeded.
- Document uploads go through `document-processing`, which runs AI extraction and stores results as `AiAuditLog` entries.
