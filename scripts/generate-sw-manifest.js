const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "assets", "generated", "sw-manifest.js");
const shouldCheck = process.argv.includes("--check");

const includeFiles = ["index.html", "main.js", "manifest.json", path.join("currencies", "index.html"), path.join("what-are-zaps", "index.html")];
const includeDirectories = ["assets", "lib"];
const includeExtensions = new Set([
  ".css",
  ".html",
  ".ico",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".webp",
  ".woff2",
]);
const excludedRelativePaths = new Set(["assets/generated/sw-manifest.js"]);

function toWebPath(absolutePath) {
  const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
  return `/${relativePath}`;
}

function collectFiles(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath));
      continue;
    }

    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
    if (!includeExtensions.has(path.extname(entry.name)) || excludedRelativePaths.has(relativePath)) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function buildAssetList() {
  const files = new Set();

  for (const relativePath of includeFiles) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing required file: ${relativePath}`);
    }
    files.add(absolutePath);
  }

  for (const directory of includeDirectories) {
    const absoluteDirectory = path.join(projectRoot, directory);
    if (!fs.existsSync(absoluteDirectory)) {
      continue;
    }

    for (const absolutePath of collectFiles(absoluteDirectory)) {
      files.add(absolutePath);
    }
  }

  return Array.from(files)
    .map((absolutePath) => toWebPath(absolutePath))
    .sort((left, right) => left.localeCompare(right));
}

function createVersion(assetList) {
  const hash = crypto.createHash("sha256");

  for (const assetPath of assetList) {
    hash.update(assetPath);
    hash.update("\n");
    hash.update(fs.readFileSync(path.join(projectRoot, assetPath.slice(1))));
    hash.update("\n");
  }

  return hash.digest("hex").slice(0, 12);
}

function buildManifestContent() {
  const assets = buildAssetList();
  const manifest = {
    version: createVersion(assets),
    assets,
  };

  return `self.__OSATS_SW_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;
}

const nextContent = buildManifestContent();

if (shouldCheck) {
  const currentContent = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";

  if (currentContent !== nextContent) {
    process.stderr.write("Service worker manifest is out of date. Run npm run sw:generate.\n");
    process.exit(1);
  }

  process.stdout.write("Service worker manifest is up to date.\n");
  process.exit(0);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, nextContent);
process.stdout.write(`Wrote ${path.relative(projectRoot, outputPath).replace(/\\/g, "/")}\n`);
