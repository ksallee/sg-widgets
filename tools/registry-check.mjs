// Checks both registry.json files against what each item's files import.
// An item declares every package its files import and names every item whose
// files they import; nothing more. Exit code 1 on any mismatch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRAMEWORK_PKGS = new Set(["react", "react-dom", "svelte"]);
const TW_ANIMATE =
  /\b(animate-(in|out|accordion-(up|down)|caret-blink|collapsible-(up|down))|fade-(in|out)|zoom-(in|out)|slide-(in-from|out-to)-|spin-(in|out))/;

const REGISTRIES = {
  react: {
    dir: "packages/react",
    utilsPkgs: ["cn"],
    utilsImport: /^@\/lib\/utils$/,
    uiImport: /^@\/components\/ui\/([^/]+)/,
    componentImport: /^@\/registry\/sg\/components\/([^/]+?)(?:\.tsx?|\.js)?$/,
    aliasImport: /^@\//,
    localRef: (name) => `https://sg-widgets.vercel.app/r/react/${name}.json`,
    refName: (dep) => dep.match(/^https:\/\/sg-widgets\.vercel\.app\/r\/react\/(.+)\.json$/)?.[1],
  },
  svelte: {
    dir: "packages/svelte",
    utilsPkgs: ["clsx", "tailwind-merge"],
    utilsImport: /^\$lib\/utils(\.js)?$/,
    uiImport: /^\$lib\/components\/ui\/([^/]+)/,
    componentImport: /^\$lib\/registry\/components\/([^/]+?)(?:\.svelte\.[tj]s|\.svelte|\.[tj]s)?$/,
    aliasImport: /^\$(lib|app)\b/,
    localRef: (name) => `local:${name}`,
    refName: (dep) => (dep.startsWith("local:") ? dep.slice(6) : undefined),
  },
};

function pkgName(spec) {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function scanImports(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const out = [];
  const re = /(?:^|[^\w$])(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"']+)["']/g;
  const dyn = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (let m; (m = re.exec(src)); ) out.push(m[1]);
  for (let m; (m = dyn.exec(src)); ) out.push(m[1]);
  return out;
}

function stripExt(name) {
  return name.replace(/\.svelte\.[tj]s$|\.svelte$|\.[tj]sx?$/, "");
}

function check(pkg) {
  const cfg = REGISTRIES[pkg];
  const pkgDir = path.join(ROOT, cfg.dir);
  const reg = JSON.parse(fs.readFileSync(path.join(pkgDir, "registry.json"), "utf8"));
  const items = reg.items;
  const byName = new Map(items.map((i) => [i.name, i]));
  const uiItems = new Set(items.filter((i) => i.type === "registry:ui").map((i) => i.name));
  const itemOfFile = new Map();
  for (const i of items) for (const f of i.files || []) itemOfFile.set(path.resolve(pkgDir, f.path), i);
  const findings = [];
  const report = (item, msg) => findings.push(`${pkg}/${item}: ${msg}`);
  const refName = (dep) => {
    const local = cfg.refName(dep);
    if (local) return { local: true, name: local };
    const shadcn = dep.match(/^@shadcn\/(.+)$/);
    return { local: false, name: shadcn ? shadcn[1] : dep, namespaced: !!shadcn };
  };

  const agg = byName.get("sg-widgets");
  const aggDeps = new Set((agg?.registryDependencies || []).map((d) => refName(d).name));
  for (const i of items) if (i.name !== "sg-widgets" && !aggDeps.has(i.name)) report("sg-widgets", `does not name ${i.name}`);
  for (const d of aggDeps) if (!byName.has(d)) report("sg-widgets", `names unknown item ${d}`);

  for (const item of items) {
    if (item.name === "sg-widgets") continue;
    const declaredPkgs = new Set(item.dependencies || []);
    const declaredReg = item.registryDependencies || [];
    const declaredRegNames = new Map(declaredReg.map((d) => [refName(d).name, d]));
    const usedPkgs = new Map();
    const usedUi = new Map();
    const usedLocal = new Map();
    let usesUtils = false;
    let usesTwAnimate = false;
    const itemFiles = new Set((item.files || []).map((f) => stripExt(path.basename(f.path))));

    for (const dup of (item.dependencies || []).filter((d, i, a) => a.indexOf(d) !== i)) report(item.name, `duplicate dependency ${dup}`);
    for (const dup of declaredReg.filter((d, i, a) => a.indexOf(d) !== i)) report(item.name, `duplicate registryDependency ${dup}`);

    for (const f of item.files || []) {
      const abs = path.resolve(pkgDir, f.path);
      const file = path.basename(f.path);
      if (!fs.existsSync(abs)) {
        report(item.name, `file missing on disk: ${f.path}`);
        continue;
      }
      if (f.type !== item.type) report(item.name, `file ${f.path} is ${f.type} in a ${item.type} item`);
      const src = fs.readFileSync(abs, "utf8");
      if (TW_ANIMATE.test(src)) usesTwAnimate = true;
      for (const spec of scanImports(src)) {
        let m;
        if (spec.startsWith(".")) {
          // Sibling files flatten to one folder on install, so a relative import
          // reaches another item only when both are components and it is named.
          const target = path.resolve(path.dirname(abs), spec);
          const owner = [target, target.replace(/\.js$/, ".ts"), `${target}.ts`, `${target}.tsx`].map((t) => itemOfFile.get(t)).find(Boolean);
          if (!owner) report(item.name, `relative import ${spec} in ${file} is not a registry file`);
          else if (owner.name !== item.name) {
            if (owner.type !== "registry:component" || item.type !== "registry:component") report(item.name, `relative import ${spec} in ${file} crosses into a ${owner.type} item`);
            usedLocal.set(owner.name, file);
          }
          continue;
        }
        if ((m = spec.match(cfg.uiImport))) {
          usedUi.set(m[1], file);
          continue;
        }
        if ((m = spec.match(cfg.componentImport))) {
          if (!itemFiles.has(m[1])) usedLocal.set(m[1], file);
          continue;
        }
        if (cfg.utilsImport.test(spec)) {
          usesUtils = true;
          continue;
        }
        if (cfg.aliasImport.test(spec)) {
          report(item.name, `alias import ${spec} in ${file} is not one the CLI rewrites`);
          continue;
        }
        const p = pkgName(spec);
        if (FRAMEWORK_PKGS.has(p)) continue;
        if (!usedPkgs.has(p)) usedPkgs.set(p, file);
      }
    }

    if (usesUtils) for (const u of cfg.utilsPkgs) if (!declaredPkgs.has(u)) report(item.name, `imports lib/utils but does not declare ${u}`);
    if (!usesUtils) for (const u of cfg.utilsPkgs) if (declaredPkgs.has(u) && !usedPkgs.has(u)) report(item.name, `declares ${u} but never imports lib/utils`);
    if (usesTwAnimate && !declaredPkgs.has("tw-animate-css")) report(item.name, `carries tw-animate-css classes but does not declare tw-animate-css`);
    if (!usesTwAnimate && declaredPkgs.has("tw-animate-css")) report(item.name, `declares tw-animate-css but carries no animate class`);

    for (const [p, file] of usedPkgs) if (!declaredPkgs.has(p)) report(item.name, `imports ${p} in ${file} but does not declare it`);
    for (const p of declaredPkgs) {
      if ([...cfg.utilsPkgs, "tw-animate-css"].includes(p)) continue;
      if (!usedPkgs.has(p)) report(item.name, `declares ${p} but no file imports it`);
    }

    for (const [name, file] of usedUi) {
      const want = uiItems.has(name) ? cfg.localRef(name) : name;
      const have = declaredRegNames.get(name);
      if (!have) report(item.name, `imports ui/${name} in ${file} but registryDependencies lacks it`);
      else if (have !== want) report(item.name, `imports ui/${name}; declared as ${have}, expected ${want}`);
    }
    for (const [name, file] of usedLocal) {
      const want = cfg.localRef(name);
      const have = declaredRegNames.get(name);
      if (!byName.has(name)) report(item.name, `imports ${name} in ${file} which is not a registry item`);
      else if (!have) report(item.name, `imports ${name} in ${file} but registryDependencies lacks it`);
      else if (have !== want) report(item.name, `imports ${name}; declared as ${have}, expected ${want}`);
    }
    for (const [name, dep] of declaredRegNames) {
      const { local } = refName(dep);
      if (local && !byName.has(name)) report(item.name, `registryDependency ${dep} names an item that does not exist`);
      if (!usedUi.has(name) && !usedLocal.has(name)) report(item.name, `declares registryDependency ${dep} but no file imports it`);
    }
  }
  return findings;
}

const findings = [...check("react"), ...check("svelte")];
if (findings.length) {
  console.error(findings.join("\n"));
  console.error(`\n${findings.length} registry mismatch${findings.length === 1 ? "" : "es"}`);
  process.exit(1);
}
console.log("registry.json matches the sources in both packages");
