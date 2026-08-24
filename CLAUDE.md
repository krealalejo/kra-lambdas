# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install
pnpm test                              # Vitest run + coverage
pnpm test:watch                        # watch mode
pnpm build                             # Esbuild → dist/index.js and dist/email.js
pnpm typecheck
```

To run a single test file: `pnpm vitest run src/thumbnail.test.ts`

Coverage threshold: 80% on lines/statements/functions/branches.

## Architecture

Two independent Lambda handlers, each with its own logic module and test file:

### Thumbnail processor (`src/index.ts` → `dist/index.js`)

**Trigger:** S3 `ObjectCreated` event on the `uploads/` prefix.

Flow:

1. Decodes the S3 key (URL-encoded `+` → space)
2. `isProcessableImage(key)` — skips keys outside `uploads/` or with non-image extensions
3. `selectStrategy(key)` — picks processing params based on path prefix:
   - `uploads/portraits/` → 600px wide, quality 82 (`PORTRAIT_STRATEGY`)
   - `uploads/logos/` → 128px wide, quality 90, `trim()` + `ensureAlpha()` (`LOGO_STRATEGY`)
   - everything else → 400px wide, quality 80 (`DEFAULT_STRATEGY`)
4. `buildOutputKey(key)` — maps input path to output path:
   - `uploads/portraits/x.jpg` → `portraits/x.webp`
   - `uploads/logos/x.png` → `logos/x.webp`
   - `uploads/blog/x.jpg` → `blog/x-cover.webp`
   - other → `processed/x.webp`
5. Writes WebP to the output key, then **deletes the original** upload

`sharp` is marked `external` in esbuild — it is provided by a Lambda layer built by Terraform (linux/amd64 Docker build).

### Email notifier (`src/email-handler.ts` → `dist/email.js`)

**Trigger:** DynamoDB Streams on the `kra-table`, `INSERT` events only.

Flow:

1. Filters to `INSERT` records only
2. Reads `email` and `message` from `NewImage` (DynamoDB Streams format — `{ S: "value" }`)
3. Calls `sendLeadNotification(email, message)` → SES `SendEmailCommand`
4. On SES failure, re-throws — DynamoDB Streams will retry the batch

Env vars required on the Lambda: `FROM_EMAIL` (verified SES identity, used as both sender and recipient via `TO_EMAIL`).

### Build notes

Esbuild bundles to **CJS** format targeting Node 20. `@aws-sdk/*` and `sharp` are both `external` — the AWS SDK is provided by the Lambda runtime and `sharp` by the custom layer. Build must complete before `terraform apply` (Terraform zips `dist/index.js` and `dist/email.js`).
