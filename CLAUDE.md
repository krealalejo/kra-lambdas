# CLAUDE.md — kra-lambdas

## Interaction Rules

- **Language:** All code, comments, variable names, and documentation files must be written in English.
- **Git Strategy:** Trunk Based Development. Each GSD phase executes on a dedicated branch `feat/phase-NN-<slug>` branched from `main`. Never commit directly to `main`.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- **Atomic:** Split commits at the handler or module level — one new handler = one commit.

## Lambda-Specific Rules

- **Runtime:** Node.js 20, TypeScript. All source in `src/`; built artifacts in `dist/` via Esbuild (`yarn build`).
- **Package manager:** Yarn.
- **Tests:** Vitest for unit tests. `yarn test` must pass before any commit.
- **Deployment:** Managed entirely by Terraform in `kra-infra`. Do NOT deploy Lambda functions manually with AWS CLI — Terraform owns the infrastructure state.
- **Idempotent handlers:** All Lambda handlers must be safe to retry. DynamoDB writes use conditional expressions or upserts where needed.
- **No credentials in code:** Lambda execution roles (IAM) grant permissions — never hardcode AWS credentials or pass them as environment variables.
- **Bundle size:** Keep bundles small. Sharp is a native module — use the Lambda layer provisioned by Terraform (`sharp-layer`) rather than bundling Sharp directly.

## Repository Context

Two Lambda functions in `src/`:
- **`src/index.ts`** (thumbnail processor): Triggered by S3 `ObjectCreated` events. Reads the uploaded image from S3, generates a 300px WebP thumbnail using Sharp, writes to the `thumbnails/` key prefix in the same bucket.
- **`src/email-handler.ts`** (email notifier): Triggered by DynamoDB Streams (`NEW_IMAGE` filter, Lead items only). Reads the Lead record from the stream, sends an SES email notification to `krealalejo@gmail.com`. Uses an SQS dead-letter queue for failed invocations.

See [kra-docs-architecture](https://github.com/krealalejo/kra-docs-architecture) for the full system C4 diagrams.

## Current Phase: 21 — C4 Final & Launch

All features complete. This phase adds README badges and this CLAUDE.md only. No handler or infrastructure changes.
