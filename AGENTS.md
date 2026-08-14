# Praxa public documentation instructions

This repository publishes [docs.praxa.io](https://docs.praxa.io) with
Mintlify. Write for external developers and product users. Do not use the site
as an engineering status ledger.

## Source authority

- Verify package examples against the exact public versions declared in the
  page. Praxa SDK, CLI, and MCP examples currently target `0.3.0`.
- Verify REST behavior against the checked OpenAPI documents and the current
  public capability catalog. Never infer a public endpoint from an internal
  route, database function, or product capability.
- Treat runtime deployment, authenticated canaries, docs publication, and
  source changes as separate evidence. Describe only the strongest proven lane.
- Preserve established Aura-compatible wire names in SDK and MCP examples even
  when the TypeScript export uses Praxa branding.

## Public content boundary

- Explain what a developer can build, which credential owns the call, what
  success evidence to inspect, and how to recover or clean up.
- Do not publish branch names, worktree paths, migration timestamps, raw table
  or RPC names, service-role details, internal worker topology, exact deploy
  hashes, or private release receipts.
- Never claim that task admission proves completion, provider recall proves a
  write, a product capability is automatically a public API, or a source-ready
  feature is available to customers.
- Keep Execution Fabric API keys, Integration Gateway OAuth tokens, provider
  clients, webhook signing secrets, and application sessions in their separate
  documented boundaries.
- Use disposable values in examples. Never place real credentials, customer
  data, or provider tokens in source, screenshots, query strings, or logs.

## Writing and visual design

- Use active voice and second person. Prefer a decision table, diagram, steps,
  or tested example over a long undifferentiated paragraph.
- Every diagram must add information, use readable labels, and remain useful in
  both themes and at mobile width. Every image needs meaningful alt text.
- Define status and proof boundaries next to claims. State limitations and
  unavailable behavior directly instead of hiding them in a footnote.
- Framework tutorials must include installation, a server-side credential
  boundary, an end-to-end verification path, negative tests, and cleanup.
- Interactive API pages use `api:` frontmatter, bearer authentication, and
  `playground: "interactive"`. Keep mutation examples disposable and
  least-privilege.

## Generated documentation

The following sources generate public pages and visuals:

- `data/public-capabilities.json`
- `benchmarks/data/terminal-bench-summary.json`
- `fabric/api/openapi.yaml`
- `memory-federation/openapi.yaml`

Run `npm run docs:generate` after editing any of them. Do not hand-edit files
that carry a generated-source notice.

## Required verification

For any non-trivial documentation change:

1. Run `npm ci` when dependencies changed.
2. Run `npm run docs:quality`.
3. Run `npm run docs:dev` and inspect representative wide and 375 px pages in
   light and dark themes. Exercise every new interactive control without using
   a production credential.
4. Review the Git diff for internal terminology, stale version numbers,
   unsupported methods, broken code fences, and overclaimed status.
5. Merge through a reviewed pull request. After Mintlify publishes default
   branch, verify the custom-domain pages and navigation again.
