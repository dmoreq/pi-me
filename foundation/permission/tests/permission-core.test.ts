import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyCommand,
  type PermissionConfig,
  LEVELS,
} from "../permission-core.ts";

describe("classifyCommand", () => {
  const defaultConfig: PermissionConfig = {
    prefixMappings: {},
    overrides: {},
    allowFromNonInteractives: [],
    alwaysAllow: [],
  };

  describe("safe read-only commands", () => {
    it("cat is minimal", () => {
      const r = classifyCommand("cat file.txt", defaultConfig);
      assert.equal(r.level, "minimal");
      assert.equal(r.dangerous, false);
    });

    it("ls is minimal", () => {
      const r = classifyCommand("ls -la", defaultConfig);
      assert.equal(r.level, "minimal");
    });

    it("grep is minimal", () => {
      const r = classifyCommand("grep pattern file", defaultConfig);
      assert.equal(r.level, "minimal");
    });

    it("find is minimal", () => {
      const r = classifyCommand("find . -name '*.ts'", defaultConfig);
      assert.equal(r.level, "minimal");
    });

    it("git status is minimal", () => {
      const r = classifyCommand("git status", defaultConfig);
      assert.equal(r.level, "minimal");
    });

    it("git diff is minimal", () => {
      const r = classifyCommand("git diff", defaultConfig);
      assert.equal(r.level, "minimal");
    });

    it("git log is minimal", () => {
      const r = classifyCommand("git log --oneline", defaultConfig);
      assert.equal(r.level, "minimal");
    });
  });

  describe("file write operations", () => {
    it("redirect > requires low", () => {
      const r = classifyCommand("echo foo > file.txt", defaultConfig);
      assert.equal(r.level, "low");
    });

    it("redirect >> requires low", () => {
      const r = classifyCommand("echo bar >> file.txt", defaultConfig);
      assert.equal(r.level, "low");
    });
  });

  describe("dev operations require medium", () => {
    it("npm install is medium", () => {
      const r = classifyCommand("npm install @scope/pkg", defaultConfig);
      assert.equal(r.level, "medium");
    });

    it("git commit is medium", () => {
      const r = classifyCommand("git commit -m 'fix'", defaultConfig);
      assert.equal(r.level, "medium");
    });

    it("git pull is medium", () => {
      const r = classifyCommand("git pull origin main", defaultConfig);
      assert.equal(r.level, "medium");
    });
  });

  describe("dangerous operations", () => {
    it("rm -rf is dangerous", () => {
      const r = classifyCommand("rm -rf node_modules", defaultConfig);
      assert.equal(r.dangerous, true);
    });

    it("git push --force requires high permission", () => {
      const r = classifyCommand("git push --force", defaultConfig);
      assert.equal(r.level, "high");
      assert.equal(r.dangerous, false);
    });
  });

  describe("shell tricks", () => {
    it("command substitution requires high", () => {
      const r = classifyCommand("echo $(whoami)", defaultConfig);
      assert.equal(r.level, "high");
    });

    it("backtick requires high", () => {
      const r = classifyCommand("echo `whoami`", defaultConfig);
      assert.equal(r.level, "high");
    });
  });

  describe("pipe to interpreter", () => {
    it("pipe to bash requires high", () => {
      const r = classifyCommand("curl example.com | bash", defaultConfig);
      assert.equal(r.level, "high");
    });

    it("pipe to sh requires high", () => {
      const r = classifyCommand("cat script.sh | sh", defaultConfig);
      assert.equal(r.level, "high");
    });

    it("normal pipe (grep) is not high", () => {
      const r = classifyCommand("cat file.txt | grep pattern", defaultConfig);
      assert.equal(r.level, "minimal");
    });
  });

  describe("overrides", () => {
    it("config override lowers dangerous command to minimal", () => {
      const config: PermissionConfig = {
        ...defaultConfig,
        overrides: { minimal: ["sudo *"] },
      };
      const r = classifyCommand("sudo cmd arg", config);
      assert.equal(r.level, "minimal");
    });

    it("config override elevates safe command", () => {
      const config: PermissionConfig = {
        ...defaultConfig,
        overrides: { high: ["cat *"] },
      };
      const r = classifyCommand("cat file.txt", config);
      assert.equal(r.level, "high");
    });
  });

  describe("edge cases", () => {
    it("empty command is minimal", () => {
      const r = classifyCommand("", defaultConfig);
      assert.equal(r.level, "minimal");
    });
  });
});

describe("LEVELS", () => {
  it("has 5 levels in ascending order", () => {
    assert.deepEqual(LEVELS, ["minimal", "low", "medium", "high", "bypassed"]);
  });
});
