# Praxa documentation

This repository contains the source for [docs.praxa.io](https://docs.praxa.io).
It documents the Praxa TypeScript SDK, CLI, MCP contracts, and governed agent
harness concepts. The public packages are maintained in
[`praxa-labs/praxa`](https://github.com/praxa-labs/praxa).

## Research and evidence

The preprint [_From Proposal to Verified Effect: Praxa, an Evidence-Bound
Harness for Governed AI Agent
Execution_](https://github.com/praxa-labs/praxa-benchmarks/releases/tag/preprint-v1.1.0)
describes the harness architecture and reports the current evidence with its
claim boundaries. You can download the publication as
[PDF](https://github.com/praxa-labs/praxa-benchmarks/releases/download/preprint-v1.1.0/praxa-harness-preprint.pdf)
or
[DOCX](https://github.com/praxa-labs/praxa-benchmarks/releases/download/preprint-v1.1.0/praxa-harness-preprint.docx).
The tagged release also preserves the
[LaTeX source](https://github.com/praxa-labs/praxa-benchmarks/tree/preprint-v1.1.0/paper),
[evidence data](https://github.com/praxa-labs/praxa-benchmarks/tree/preprint-v1.1.0/paper/data),
[evaluation protocols](https://github.com/praxa-labs/praxa-benchmarks/tree/preprint-v1.1.0/paper/protocols),
and [pipeline improvement
roadmap](https://github.com/praxa-labs/praxa-benchmarks/blob/preprint-v1.1.0/paper/PIPELINE-IMPROVEMENT-ROADMAP.md).

The publication separates repository-local regression and conformance checks
from a small Terminal-Bench pilot. Neither lane is production evidence or a
demonstration of harness superiority. See the [benchmark and evidence
guide](https://docs.praxa.io/benchmarks/overview) before interpreting a result.

## Local development

Install the checked documentation dependencies, regenerate source-backed pages,
and run the same static quality gate used for pull requests:

```bash
npm ci
npm run docs:generate
npm run docs:quality
npm run docs:dev
```

Open `http://localhost:3000` to review the site. Navigation and theme settings
live in `docs.json`; documentation pages use MDX. The local command pins the
Mint CLI version so a global installation cannot silently change validation.

The quality gate verifies generated capability, benchmark, and API Playground
pages; executable examples; navigation and internal links; both OpenAPI
documents; Mermaid and accessible visual coverage; and Mintlify broken links.

## Publishing changes

The Mintlify GitHub app deploys changes after they reach the default branch.
The repository quality workflow must pass before merge. After merge, verify a
representative Overview, tutorial, benchmark, and API Playground page on the
custom domain; a merged source commit is not the same proof as live CDN output.

## License

See [LICENSE](LICENSE).
