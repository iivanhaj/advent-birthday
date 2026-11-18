/**
 * Which "tech stack" a file belongs to, by extension, plus a light tint for
 * each. The greenhouse fills a push's flower with the tint of the kind of file
 * it touched most, so you can see at a glance what each day was spent on.
 */
export type FileKind = "ts" | "css" | "sql" | "md" | "config" | "java" | "py" | "rust" | "html" | "asset" | "other";
export type FileCounts = Partial<Record<FileKind, number>>;

export const KINDS: Record<FileKind, { label: string; tint: string }> = {
  ts: { label: "TypeScript", tint: "#F7C6D2" },
  css: { label: "CSS", tint: "#FBE5A6" },
  sql: { label: "SQL", tint: "#BFE6DD" },
  md: { label: "Markdown", tint: "#DDD3F6" },
  config: { label: "Config", tint: "#CDE3F5" },
  java: { label: "Java", tint: "#F9D3B9" },
  py: { label: "Python", tint: "#D3E8C2" },
  rust: { label: "Rust", tint: "#EFC9B3" },
  html: { label: "HTML", tint: "#F6D0C4" },
  asset: { label: "Images", tint: "#E7DED6" },
  other: { label: "Other", tint: "#F1DCE2" },
};

const EXT: Record<string, FileKind> = {
  ts: "ts", tsx: "ts", js: "ts", jsx: "ts", mjs: "ts", cjs: "ts",
  css: "css", scss: "css", sass: "css",
  sql: "sql",
  md: "md", mdx: "md", txt: "md",
  json: "config", yaml: "config", yml: "config", toml: "config", lock: "config", env: "config", gitignore: "config",
  java: "java", kt: "java",
  py: "py", ipynb: "py",
  rs: "rust", wasm: "rust",
  html: "html", htm: "html",
  png: "asset", jpg: "asset", jpeg: "asset", gif: "asset", svg: "asset", webp: "asset", ico: "asset",
};

export function kindOf(path: string): FileKind {
  const name = path.split("/").pop() ?? path;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : name.toLowerCase().replace(/^\./, "");
  return EXT[ext] ?? "other";
}

/** Count distinct paths by kind. */
export function countKinds(paths: Iterable<string>): FileCounts {
  const out: FileCounts = {};
  for (const p of new Set(paths)) {
    const k = kindOf(p);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** The kind a push touched most (ties broken by the order in KINDS). Null when unknown. */
export function mainKind(files: FileCounts | null | undefined): FileKind | null {
  if (!files) return null;
  let best: FileKind | null = null;
  for (const k of Object.keys(KINDS) as FileKind[]) {
    const n = files[k] ?? 0;
    if (n > 0 && (best == null || n > (files[best] ?? 0))) best = k;
  }
  return best;
}
