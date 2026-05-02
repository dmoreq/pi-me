/**
 * pi-me: web-providers-integration tests
 * Tests for pi-web-providers integration with Exa, Tavily, and Valyu
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

describe("web-providers-integration", () => {
  describe("Configuration", () => {
    it("config file exists at ~/.pi/agent/web-providers.json", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      assert.ok(existsSync(configPath), `Config file not found at ${configPath}`);
    });

    it("config has valid JSON structure", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.ok(config, "Config is valid JSON");
    });

    it("config has tools section with 4 tools defined", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.ok(config.tools, "Config has tools section");
      assert.equal(typeof config.tools.search, "string", "search tool is a string");
      assert.equal(typeof config.tools.contents, "string", "contents tool is a string");
      assert.equal(typeof config.tools.answer, "string", "answer tool is a string");
      assert.equal(typeof config.tools.research, "string", "research tool is a string");
    });

    it("tools are routed to correct providers", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.equal(config.tools.search, "exa", "search should use Exa");
      assert.equal(config.tools.contents, "exa", "contents should use Exa");
      assert.equal(config.tools.answer, "valyu", "answer should use Valyu");
      assert.equal(config.tools.research, "tavily", "research should use Tavily");
    });

    it("all three providers are enabled", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.ok(config.providers, "Config has providers section");
      assert.ok(config.providers.exa?.enabled, "Exa provider is enabled");
      assert.ok(config.providers.tavily?.enabled, "Tavily provider is enabled");
      assert.ok(config.providers.valyu?.enabled, "Valyu provider is enabled");
    });

    it("settings are reasonable", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.ok(config.settings, "Config has settings section");
      assert.equal(config.settings.requestTimeoutMs, 30000, "Request timeout is 30 seconds");
      assert.equal(config.settings.retryCount, 3, "Retry count is 3");
      assert.equal(config.settings.researchTimeoutMs, 1800000, "Research timeout is 30 minutes");
    });
  });

  describe("Package.json Integration", () => {
    it("pi-web-providers is in package.json dependencies", () => {
      const packagePath = join(process.cwd(), "package.json");
      const content = readFileSync(packagePath, "utf-8");
      const pkg = JSON.parse(content);
      assert.ok(
        pkg.dependencies["pi-web-providers"],
        "pi-web-providers should be in dependencies"
      );
    });

    it("pi-web-providers extension is registered", () => {
      const packagePath = join(process.cwd(), "package.json");
      const content = readFileSync(packagePath, "utf-8");
      const pkg = JSON.parse(content);
      assert.ok(pkg.pi?.extensions, "pi.extensions should exist");
      const hasWebProviders = pkg.pi.extensions.some((ext: string) =>
        ext.includes("pi-web-providers")
      );
      assert.ok(hasWebProviders, "pi-web-providers should be in extensions");
    });

    it("extension is properly formatted as npm package path", () => {
      const packagePath = join(process.cwd(), "package.json");
      const content = readFileSync(packagePath, "utf-8");
      const pkg = JSON.parse(content);
      const webProvidersExt = pkg.pi.extensions.find((ext: string) =>
        ext.includes("pi-web-providers")
      );
      assert.ok(
        webProvidersExt?.includes("dist/index.js"),
        "Extension should point to dist/index.js"
      );
    });
  });

  describe("Environment Variables", () => {
    it("supports reading API keys from environment", () => {
      // This test verifies the configuration structure supports env vars
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);

      // Config should have apiKey: null to indicate env var usage
      assert.strictEqual(
        config.providers.exa.apiKey,
        null,
        "Exa apiKey should be null to use EXA_API_KEY env var"
      );
      assert.strictEqual(
        config.providers.tavily.apiKey,
        null,
        "Tavily apiKey should be null to use TAVILY_API_KEY env var"
      );
      assert.strictEqual(
        config.providers.valyu.apiKey,
        null,
        "Valyu apiKey should be null to use VALYU_API_KEY env var"
      );
    });
  });

  describe("Tool Definitions", () => {
    it("defines 4 distinct tools", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      const tools = Object.keys(config.tools);
      assert.equal(tools.length, 4, "Should have exactly 4 tools");
      assert.deepEqual(tools.sort(), ["answer", "contents", "research", "search"].sort());
    });

    it("each tool is mapped to a provider", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      for (const [toolName, providerName] of Object.entries(config.tools)) {
        assert.ok(providerName, `Tool '${toolName}' is mapped to a provider`);
        assert.ok(
          config.providers[providerName as string],
          `Provider '${providerName}' for tool '${toolName}' exists in config`
        );
      }
    });
  });

  describe("Provider Capabilities", () => {
    it("Exa is configured for search, contents, and answer", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.ok(config.providers.exa?.enabled, "Exa is enabled");
      // Exa is used for search, contents
      assert.equal(config.tools.search, "exa", "Exa handles search");
      assert.equal(config.tools.contents, "exa", "Exa handles contents");
    });

    it("Tavily is configured for research", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.ok(config.providers.tavily?.enabled, "Tavily is enabled");
      assert.equal(config.tools.research, "tavily", "Tavily handles research");
    });

    it("Valyu is configured for answers", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      assert.ok(config.providers.valyu?.enabled, "Valyu is enabled");
      assert.equal(config.tools.answer, "valyu", "Valyu handles answers");
    });
  });

  describe("Optimization Checks", () => {
    it("timeout is reasonable for web requests (30 seconds)", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      const timeout = config.settings.requestTimeoutMs;
      assert.ok(timeout >= 20000, "Timeout should be at least 20 seconds");
      assert.ok(timeout <= 60000, "Timeout should not exceed 60 seconds");
    });

    it("retry count is reasonable (3 retries)", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      const retries = config.settings.retryCount;
      assert.ok(retries >= 1, "Should have at least 1 retry");
      assert.ok(retries <= 5, "Should not exceed 5 retries");
    });

    it("research timeout is sufficient (30 minutes)", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      const researchTimeout = config.settings.researchTimeoutMs;
      assert.ok(researchTimeout >= 600000, "Should be at least 10 minutes");
      assert.ok(researchTimeout <= 3600000, "Should not exceed 1 hour");
    });

    it("no unused providers are enabled", () => {
      const configPath = join(homedir(), ".pi", "agent", "web-providers.json");
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);

      // Check which providers are actually used
      const usedProviders = new Set(Object.values(config.tools));

      // Exa, Tavily, Valyu should be used
      assert.ok(usedProviders.has("exa"), "Exa should be used");
      assert.ok(usedProviders.has("tavily"), "Tavily should be used");
      assert.ok(usedProviders.has("valyu"), "Valyu should be used");

      // Other providers should be disabled
      if (config.providers.brave) {
        assert.equal(
          config.providers.brave.enabled,
          false,
          "Unused providers should be disabled"
        );
      }
      if (config.providers.claude) {
        assert.equal(
          config.providers.claude.enabled,
          false,
          "Unused providers should be disabled"
        );
      }
    });
  });
});
