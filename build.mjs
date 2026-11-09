#!/usr/bin/env node
/**
 * Maintains the figure library in this repository. Depends only on Node.js and,
 * for --previews and --verify, on latexmk and pdftocairo (poppler).
 *
 *   node build.mjs                 write catalog.json
 *   node build.mjs --check         fail if catalog.json is out of date
 *   node build.mjs --previews      draw missing preview.svg files
 *   node build.mjs --previews a b  redraw the previews of figures a and b
 *   node build.mjs --verify        compile every figure
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const figuresRoot = path.join(root, "figures");
const catalogPath = path.join(root, "catalog.json");
const TYPE_ORDER = ["template", "example", "icon", "plot"];
const CONCURRENCY = 6;
const args = process.argv.slice(2);

function readFigures() {
  const figures = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      if (fs.existsSync(path.join(child, "meta.json"))) figures.push({ directory: child, meta: JSON.parse(fs.readFileSync(path.join(child, "meta.json"), "utf8")) });
      else visit(child);
    }
  };
  visit(figuresRoot);
  return figures;
}

function validate(figures, categories) {
  const ids = new Set();
  const categoryIds = new Set(categories.map(({ id }) => id));
  for (const { directory, meta } of figures) {
    const where = path.relative(root, directory);
    const fail = (message) => { throw new Error(`${where}: ${message}`); };
    if (!meta.id || path.basename(directory) !== meta.id) fail("meta.json id must match the directory name");
    if (ids.has(meta.id)) fail("duplicate id");
    ids.add(meta.id);
    if (!meta.name) fail("meta.json needs a name");
    if (!meta.license) fail("meta.json needs a license");
    if (!TYPE_ORDER.includes(meta.type)) fail(`unknown type ${meta.type}`);
    if (meta.type === "icon" && !categoryIds.has(meta.category)) fail(`unknown category ${meta.category}`);
    if (!fs.existsSync(path.join(directory, "figure.tex"))) fail("figure.tex is missing");
  }
}

function catalogFor(figures, categories, library) {
  const relative = (figure, name) => path.relative(root, path.join(figure.directory, name)).split(path.sep).join("/");
  const items = figures.map((figure) => {
    const { meta } = figure;
    return {
      id: meta.id, name: meta.name, type: meta.type, ...(meta.category ? { category: meta.category } : {}),
      domain: meta.domain ?? [], tags: meta.tags ?? [], description: meta.description ?? "", requires: meta.requires ?? [],
      featured: meta.featured === true, tex: relative(figure, "figure.tex"), preview: relative(figure, "preview.svg")
    };
  }).sort((left, right) => TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type)
    || Number(right.featured) - Number(left.featured)
    || left.name.localeCompare(right.name, "en"));
  return `${JSON.stringify({ version: 1, ...library, categories, items }, null, 1)}\n`;
}

function run(command, commandArgs, cwd) {
  return new Promise((resolve) => {
    let log = "";
    const child = spawn(command, commandArgs, { cwd });
    const collect = (chunk) => { log = (log + chunk).slice(-1500); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => resolve(`${command}: ${error.message}`));
    child.on("close", (code) => resolve(code === 0 ? null : log));
  });
}

/** Compiles outside the library so that no build products land in it. */
async function compile(figure, outdir) {
  return run("latexmk", ["-pdf", "-interaction=nonstopmode", "-halt-on-error", `-outdir=${outdir}`, "figure.tex"], figure.directory);
}

async function forEachFigure(figures, work) {
  const failures = [];
  const queue = [...figures];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let figure = queue.shift(); figure; figure = queue.shift()) {
      const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "texlite-gallery-"));
      try {
        const failure = await work(figure, outdir);
        if (failure) failures.push({ id: figure.meta.id, failure });
      } finally {
        fs.rmSync(outdir, { recursive: true, force: true });
      }
    }
  }));
  for (const { id, failure } of failures) console.error(`--- ${id}\n${failure}`);
  console.log(`${figures.length - failures.length} of ${figures.length} figures succeeded`);
  if (failures.length) process.exitCode = 1;
}

function drawPreview(figure, outdir) {
  return compile(figure, outdir).then((failure) => failure ?? run("pdftocairo", ["-svg", path.join(outdir, "figure.pdf"), path.join(figure.directory, "preview.svg")], outdir));
}

const figures = readFigures();
const categories = JSON.parse(fs.readFileSync(path.join(root, "categories.json"), "utf8"));
validate(figures, categories);

if (args.includes("--previews")) {
  const named = args.filter((arg) => !arg.startsWith("--"));
  await forEachFigure(figures.filter(({ directory, meta }) => named.length ? named.includes(meta.id) : !fs.existsSync(path.join(directory, "preview.svg"))), drawPreview);
}
for (const { directory } of figures) {
  if (!fs.existsSync(path.join(directory, "preview.svg"))) throw new Error(`${path.relative(root, directory)}: preview.svg is missing; run with --previews`);
}

const catalog = catalogFor(figures, categories, JSON.parse(fs.readFileSync(path.join(root, "library.json"), "utf8")));
if (args.includes("--check")) {
  if (!fs.existsSync(catalogPath) || fs.readFileSync(catalogPath, "utf8") !== catalog) {
    console.error("catalog.json is out of date; run node build.mjs");
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(catalogPath, catalog);
  console.log(`Catalog: ${figures.length} figures`);
}
if (args.includes("--verify")) await forEachFigure(figures, (figure, outdir) => compile(figure, outdir));
