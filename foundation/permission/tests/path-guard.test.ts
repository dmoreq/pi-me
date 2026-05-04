/**
 * Tests for path-guard.ts — protected path glob matching.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROTECTED_PATHS, matchesGlob } from "../path-guard.ts";

describe("path-guard", () => {
  describe("matchesGlob", () => {
    describe("exact matches", () => {
      it("matches exact filename", () => {
        assert.ok(matchesGlob(".env", ".env"));
      });

      it("matches .env.*", () => {
        assert.ok(matchesGlob(".env.production", ".env.*"));
        assert.ok(matchesGlob(".env.local", ".env.*"));
        assert.ok(!matchesGlob(".env", ".env.*"));
      });

      it("matches .envrc", () => {
        assert.ok(matchesGlob(".envrc", ".envrc"));
        assert.ok(!matchesGlob(".envrc.local", ".envrc"));
      });
    });

    describe("globstar patterns", () => {
      it("matches **/id_rsa anywhere", () => {
        assert.ok(matchesGlob(".ssh/id_rsa", "**/id_rsa"));
        assert.ok(matchesGlob("home/user/.ssh/id_rsa", "**/id_rsa"));
        assert.ok(!matchesGlob("id_rsa.pub", "**/id_rsa"));
      });

      it("matches **/*.key anywhere", () => {
        assert.ok(matchesGlob("certs/server.key", "**/*.key"));
        assert.ok(matchesGlob(".ssh/some.key", "**/*.key"));
        assert.ok(matchesGlob("a.key", "**/*.key"));
        assert.ok(!matchesGlob("key.pem", "**/*.key"));
      });

      it("matches **/.ssh/config", () => {
        assert.ok(matchesGlob(".ssh/config", "**/.ssh/config"));
        assert.ok(matchesGlob("user/.ssh/config", "**/.ssh/config"));
        assert.ok(!matchesGlob(".ssh/known_hosts", "**/.ssh/config"));
      });

      it("matches **/secrets.yml", () => {
        assert.ok(matchesGlob("config/secrets.yml", "**/secrets.yml"));
        assert.ok(matchesGlob("secrets.yml", "**/secrets.yml"));
      });

      it("matches nested .gnupg/**", () => {
        assert.ok(matchesGlob(".gnupg/private-keys-v1.d/something.key", "**/.gnupg/**"));
        assert.ok(matchesGlob("home/.gnupg/pubring.kbx", "**/.gnupg/**"));
      });
    });

    describe("workflow files", () => {
      it("matches .github/workflows/*.yml", () => {
        assert.ok(matchesGlob(".github/workflows/ci.yml", "**/.github/workflows/*.yml"));
        assert.ok(matchesGlob(".github/workflows/deploy.yml", "**/.github/workflows/*.yml"));
        assert.ok(!matchesGlob(".github/workflows/ci.json", "**/.github/workflows/*.yml"));
      });

      it("matches .github/workflows/*.yaml", () => {
        assert.ok(matchesGlob(".github/workflows/ci.yaml", "**/.github/workflows/*.yaml"));
        assert.ok(!matchesGlob(".github/workflows/ci.yml", "**/.github/workflows/*.yaml"));
      });
    });

    describe("lock files", () => {
      it("matches **/package-lock.json", () => {
        assert.ok(matchesGlob("package-lock.json", "**/package-lock.json"));
        assert.ok(matchesGlob("packages/foo/package-lock.json", "**/package-lock.json"));
      });

      it("matches **/yarn.lock", () => {
        assert.ok(matchesGlob("yarn.lock", "**/yarn.lock"));
      });

      it("matches **/pnpm-lock.yaml", () => {
        assert.ok(matchesGlob("pnpm-lock.yaml", "**/pnpm-lock.yaml"));
      });

      it("matches **/poetry.lock", () => {
        assert.ok(matchesGlob("poetry.lock", "**/poetry.lock"));
      });

      it("matches **/Cargo.lock", () => {
        assert.ok(matchesGlob("Cargo.lock", "**/Cargo.lock"));
      });
    });

    describe("credential files", () => {
      it("matches .pypirc", () => {
        assert.ok(matchesGlob(".pypirc", ".pypirc"));
      });

      it("matches .npmrc", () => {
        assert.ok(matchesGlob(".npmrc", ".npmrc"));
      });

      it("matches .gemrc", () => {
        assert.ok(matchesGlob(".gemrc", ".gemrc"));
      });

      it("matches Cargo credentials", () => {
        assert.ok(matchesGlob(".cargo/credentials.toml", "**/.cargo/credentials.toml"));
      });
    });

    describe("PEM and key files", () => {
      it("matches **/*.pem", () => {
        assert.ok(matchesGlob("cert.pem", "**/*.pem"));
        assert.ok(matchesGlob("certs/ca.pem", "**/*.pem"));
      });

      it("matches **/*-key.pem", () => {
        assert.ok(matchesGlob("my-key.pem", "**/*-key.pem"));
        assert.ok(!matchesGlob("cert.pem", "**/*-key.pem"));
      });

      it("matches **/id_ed25519*", () => {
        assert.ok(matchesGlob(".ssh/id_ed25519", "**/id_ed25519*"));
        assert.ok(matchesGlob(".ssh/id_ed25519.pub", "**/id_ed25519*"));
        assert.ok(matchesGlob(".ssh/id_ed25519_sk", "**/id_ed25519*"));
      });

      it("matches **/id_ecdsa*", () => {
        assert.ok(matchesGlob(".ssh/id_ecdsa", "**/id_ecdsa*"));
        assert.ok(matchesGlob(".ssh/id_ecdsa.pub", "**/id_ecdsa*"));
      });
    });
  });

  describe("DEFAULT_PROTECTED_PATHS", () => {
    function isProtected(relativePath: string): boolean {
      return DEFAULT_PROTECTED_PATHS.some((p) => matchesGlob(relativePath, p.glob));
    }

    it("protects .env files", () => {
      assert.ok(isProtected(".env"));
      assert.ok(isProtected(".env.production"));
      assert.ok(isProtected(".envrc"));
    });

    it("protects SSH keys", () => {
      assert.ok(isProtected(".ssh/id_rsa"));
      assert.ok(isProtected(".ssh/id_ed25519"));
      assert.ok(isProtected(".ssh/id_ecdsa"));
    });

    it("protects lock files", () => {
      assert.ok(isProtected("package-lock.json"));
      assert.ok(isProtected("yarn.lock"));
      assert.ok(isProtected("pnpm-lock.yaml"));
      assert.ok(isProtected("poetry.lock"));
      assert.ok(isProtected("Cargo.lock"));
      assert.ok(isProtected("Gemfile.lock"));
      assert.ok(isProtected("packages/client/package-lock.json"));
    });

    it("protects CI workflows", () => {
      assert.ok(isProtected(".github/workflows/ci.yml"));
      assert.ok(isProtected(".github/workflows/deploy.yaml"));
    });

    it("protects git config", () => {
      assert.ok(isProtected(".git/config"));
      assert.ok(isProtected(".gitignore"));
    });

    it("protects credential files", () => {
      assert.ok(isProtected(".npmrc"));
      assert.ok(isProtected(".pypirc"));
      assert.ok(isProtected("config/secrets.yml"));
    });

    it("allows normal source files", () => {
      assert.ok(!isProtected("src/index.ts"));
      assert.ok(!isProtected("components/Button.tsx"));
      assert.ok(!isProtected("README.md"));
      assert.ok(!isProtected("package.json"));
    });

    it("allows normal config files", () => {
      assert.ok(!isProtected("tsconfig.json"));
      assert.ok(!isProtected(".eslintrc.js"));
      assert.ok(!isProtected("vite.config.ts"));
    });
  });
});
