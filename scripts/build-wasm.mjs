#!/usr/bin/env node
/**
 * Build door 5's Rust engine to WebAssembly and copy it to apps/web/public.
 *
 *   pnpm build:wasm
 *
 * Needs Rust with the wasm32 target (rustup target add wasm32-unknown-unknown).
 * The built .wasm is committed, so deploying (Vercel) needs no Rust at all.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const local = join(homedir(), ".cargo", "bin", process.platform === "win32" ? "cargo.exe" : "cargo");
const cargo = process.env.CARGO ?? (existsSync(local) ? local : "cargo");
const manifest = join(ROOT, "wasm", "bloom", "Cargo.toml");

execFileSync(cargo, ["build", "--release", "--target", "wasm32-unknown-unknown", "--manifest-path", manifest], { stdio: "inherit" });
const built = join(ROOT, "wasm", "bloom", "target", "wasm32-unknown-unknown", "release", "bloom.wasm");
const dest = join(ROOT, "apps", "web", "public", "bloom.wasm");
copyFileSync(built, dest);
console.log(`✓ ${dest} (${(statSync(dest).size / 1024).toFixed(1)} KB)`);
