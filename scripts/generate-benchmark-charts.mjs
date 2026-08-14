import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const data = JSON.parse(
  await readFile(path.join(root, "benchmarks/data/terminal-bench-summary.json"), "utf8"),
);

async function writeOrCheck(relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  const normalized = content.endsWith("\n") ? content : content + "\n";
  if (checkOnly) {
    let current = "";
    try {
      current = await readFile(absolutePath, "utf8");
    } catch {
      throw new Error(relativePath + " is missing; run npm run docs:generate");
    }
    if (current !== normalized) {
      throw new Error(relativePath + " is stale; run npm run docs:generate");
    }
    return;
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, normalized, "utf8");
}

function svgShell(title, description, width, height, body) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-labelledby="title desc">',
    '  <title id="title">' + title + '</title>',
    '  <desc id="desc">' + description + '</desc>',
    '  <style>',
    '    .title{font:700 20px ui-sans-serif,system-ui;fill:#171717}.label{font:600 14px ui-sans-serif,system-ui;fill:#262626}.value{font:500 13px ui-monospace,SFMono-Regular,monospace;fill:#525252}.axis{stroke:#d4d4d4}.muted{fill:#a3a3a3}.accent{fill:#007fff}.warning{fill:#f59e0b}.panel{fill:#fafafa;stroke:#e5e5e5}',
    '    @media (prefers-color-scheme:dark){.title,.label{fill:#f5f5f5}.value{fill:#d4d4d4}.axis{stroke:#404040}.panel{fill:#181818;stroke:#2a2a2a}.muted{fill:#737373}}',
    '  </style>',
    body,
    '</svg>',
  ].join("\n");
}

function outcomeChart() {
  const width = 860;
  const height = 330;
  const left = 175;
  const chartWidth = 600;
  const body = [
    '  <rect class="panel" x="1" y="1" width="858" height="328" rx="16"/>',
    '  <text class="title" x="36" y="42">Terminal-Bench pilot outcomes</text>',
    '  <text class="value" x="36" y="68">36 trials per arm · descriptive pilot · no superiority claim</text>',
  ];
  data.arms.forEach((row, index) => {
    const y = 112 + index * 92;
    const passed = (row.passed / row.total) * chartWidth;
    const unresolved = (row.unresolved / row.total) * chartWidth;
    const parseErrors = (row.parseErrors / row.total) * chartWidth;
    body.push(
      '  <text class="label" x="36" y="' + (y + 21) + '">' + row.label + '</text>',
      '  <rect class="accent" x="' + left + '" y="' + y + '" width="' + passed.toFixed(2) + '" height="34" rx="5"/>',
      '  <rect class="muted" x="' + (left + passed).toFixed(2) + '" y="' + y + '" width="' + unresolved.toFixed(2) + '" height="34"/>',
      '  <rect class="warning" x="' + (left + passed + unresolved).toFixed(2) + '" y="' + y + '" width="' + parseErrors.toFixed(2) + '" height="34" rx="5"/>',
      '  <text class="value" x="' + left + '" y="' + (y + 56) + '">17 resolved · 16 unresolved · 3 scorer-null parse errors</text>',
    );
  });
  body.push(
    '  <rect class="accent" x="36" y="292" width="14" height="14" rx="2"/><text class="value" x="57" y="304">Resolved</text>',
    '  <rect class="muted" x="162" y="292" width="14" height="14" rx="2"/><text class="value" x="183" y="304">Scored unresolved</text>',
    '  <rect class="warning" x="350" y="292" width="14" height="14" rx="2"/><text class="value" x="371" y="304">Scorer-null parse error</text>',
  );
  return svgShell(
    "Terminal-Bench pilot outcomes",
    "Both baseline and reliability-layer arms had 17 resolved trials, 16 scored unresolved trials, and 3 scorer-null parse errors out of 36 trials.",
    width,
    height,
    body.join("\n"),
  );
}

function resourceChart() {
  const width = 860;
  const height = 430;
  const metrics = [
    ["Input tokens", "inputTokens", (value) => value.toLocaleString("en-US")],
    ["Output tokens", "outputTokens", (value) => value.toLocaleString("en-US")],
    ["Agent steps", "steps", (value) => value.toLocaleString("en-US")],
    ["Elapsed seconds", "elapsedSeconds", (value) => value.toFixed(1)],
  ];
  const body = [
    '  <rect class="panel" x="1" y="1" width="858" height="428" rx="16"/>',
    '  <text class="title" x="36" y="42">Resource use by pilot arm</text>',
    '  <text class="value" x="36" y="68">Bars are normalized within each metric; labels show the measured values.</text>',
  ];
  metrics.forEach(([label, key, format], index) => {
    const top = 96 + index * 80;
    const max = Math.max(...data.arms.map((arm) => arm[key]));
    body.push('  <text class="label" x="36" y="' + (top + 18) + '">' + label + '</text>');
    data.arms.forEach((arm, armIndex) => {
      const y = top + 28 + armIndex * 22;
      const widthValue = (arm[key] / max) * 440;
      const className = armIndex === 0 ? "muted" : "accent";
      body.push(
        '  <text class="value" x="180" y="' + (y + 12) + '">' + arm.label + '</text>',
        '  <rect class="' + className + '" x="320" y="' + y + '" width="' + widthValue.toFixed(2) + '" height="15" rx="4"/>',
        '  <text class="value" x="' + (330 + widthValue).toFixed(2) + '" y="' + (y + 12) + '">' + format(arm[key]) + '</text>',
      );
    });
  });
  return svgShell(
    "Terminal-Bench pilot resource use",
    "The reliability-layer arm used more input tokens, output tokens, steps, and elapsed time than the baseline arm in this pilot.",
    width,
    height,
    body.join("\n"),
  );
}

function coverageChart() {
  const width = 860;
  const height = 360;
  const metrics = [
    ["Statements", data.coverage.statements],
    ["Branches", data.coverage.branches],
    ["Functions", data.coverage.functions],
    ["Lines", data.coverage.lines],
  ];
  const body = [
    '  <rect class="panel" x="1" y="1" width="858" height="358" rx="16"/>',
    '  <text class="title" x="36" y="42">Repository-local coverage snapshot</text>',
    '  <text class="value" x="36" y="68">1,027 unit tests and 89 Workerd tests passed in the pinned author-run summary.</text>',
  ];
  metrics.forEach(([label, value], index) => {
    const y = 102 + index * 58;
    body.push(
      '  <text class="label" x="36" y="' + (y + 16) + '">' + label + '</text>',
      '  <line class="axis" x1="175" y1="' + (y + 8) + '" x2="775" y2="' + (y + 8) + '" stroke-width="18" stroke-linecap="round"/>',
      '  <line class="accent" x1="175" y1="' + (y + 8) + '" x2="' + (175 + value * 6).toFixed(2) + '" y2="' + (y + 8) + '" stroke-width="18" stroke-linecap="round"/>',
      '  <text class="value" x="790" y="' + (y + 14) + '">' + value.toFixed(2) + '%</text>',
    );
  });
  body.push('  <text class="value" x="36" y="334">Repository-local conformance only · independently reproduced: no · production status: hold</text>');
  return svgShell(
    "Repository-local test coverage",
    "Coverage was 68.09 percent statements, 62.31 percent branches, 75.09 percent functions, and 70.84 percent lines in the pinned author-run summary.",
    width,
    height,
    body.join("\n"),
  );
}

await writeOrCheck("images/benchmarks/terminal-bench-outcomes.svg", outcomeChart());
await writeOrCheck("images/benchmarks/terminal-bench-resources.svg", resourceChart());
await writeOrCheck("images/benchmarks/repository-coverage.svg", coverageChart());

console.log((checkOnly ? "Verified" : "Generated") + " three benchmark charts from the pinned summary.");
