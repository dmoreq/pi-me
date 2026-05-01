/**
 * pi-me: github — GitHub API tool.
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

const GITHUB_API = "https://api.github.com";

function getToken(): string | undefined { return process.env.GITHUB_TOKEN || process.env.GH_TOKEN; }
function authHeaders(): Record<string, string> {
	const token = getToken();
	const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "pi-github/0.1", "X-GitHub-Api-Version": "2022-11-28" };
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

async function ghGet(path: string): Promise<any> {
	const resp = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders(), signal: AbortSignal.timeout(15000) });
	if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${await resp.text().catch(() => "")}`);
	return resp.json();
}

async function ghPost(path: string, body: unknown): Promise<any> {
	const resp = await fetch(`${GITHUB_API}${path}`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
	if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${await resp.text().catch(() => "")}`);
	return resp.json();
}

const GithubParams = Type.Object({
	action: StringEnum(["search_issues", "get_issue", "create_issue", "list_prs", "get_pr", "get_file_contents", "search_code", "search_repos"] as const),
	owner: Type.Optional(Type.String()), repo: Type.Optional(Type.String()), query: Type.Optional(Type.String()),
	issue_number: Type.Optional(Type.Number()), title: Type.Optional(Type.String()), body: Type.Optional(Type.String()),
	path: Type.Optional(Type.String()), ref: Type.Optional(Type.String()),
});

export function registerGithub(pi: ExtensionAPI) {
	pi.registerTool({
		name: "github", label: "GitHub",
		description: "Interact with GitHub: search issues/PRs/code/repos, read files, create issues. Set GITHUB_TOKEN env var for auth.",
		parameters: GithubParams,
		async execute(_toolCallId, params) {
			try {
				switch (params.action) {
					case "search_issues": {
						if (!params.query) return err("query required");
						const q = encodeURIComponent(`${params.query}${params.repo ? ` repo:${params.owner}/${params.repo}` : ""}`);
						const data = await ghGet(`/search/issues?q=${q}&per_page=10`);
						if (!data.items?.length) return ok(`No issues found for: ${params.query}`);
						return ok(data.items.map(formatIssue).join("\n\n"), { total: data.total_count, items: data.items.slice(0, 10) });
					}
					case "get_issue": {
						if (!params.owner || !params.repo || !params.issue_number) return err("owner, repo, issue_number required");
						const issue = await ghGet(`/repos/${params.owner}/${params.repo}/issues/${params.issue_number}`);
						return ok(formatIssue(issue), { issue });
					}
					case "create_issue": {
						if (!params.owner || !params.repo || !params.title) return err("owner, repo, title required");
						const issue = await ghPost(`/repos/${params.owner}/${params.repo}/issues`, { title: params.title, body: params.body || "" });
						return ok(`Created issue #${issue.number}: ${issue.html_url}`, { issue });
					}
					case "list_prs": {
						if (!params.owner || !params.repo) return err("owner and repo required");
						const prs = await ghGet(`/repos/${params.owner}/${params.repo}/pulls?state=open&per_page=10`);
						if (!prs.length) return ok("No open pull requests.");
						return ok(prs.map(formatPR).join("\n\n"), { count: prs.length });
					}
					case "get_pr": {
						if (!params.owner || !params.repo || !params.issue_number) return err("owner, repo, issue_number required");
						const pr = await ghGet(`/repos/${params.owner}/${params.repo}/pulls/${params.issue_number}`);
						return ok(formatPR(pr), { pr });
					}
					case "get_file_contents": {
						if (!params.owner || !params.repo || !params.path) return err("owner, repo, path required");
						const ref = params.ref ? `?ref=${encodeURIComponent(params.ref)}` : "";
						const data = await ghGet(`/repos/${params.owner}/${params.repo}/contents/${params.path}${ref}`);
						if (Array.isArray(data)) return ok(data.map((f: any) => `${f.type === "dir" ? "📁" : "📄"} ${f.name} (${f.size} bytes)`).join("\n"));
						const content = data.content ? Buffer.from(data.content, "base64").toString("utf-8") : "";
						return ok(truncate(content, 8000), { path: data.path, size: data.size });
					}
					case "search_code": {
						if (!params.query) return err("query required");
						const repoFilter = params.repo ? `+repo:${params.owner}/${params.repo}` : "";
						const data = await ghGet(`/search/code?q=${encodeURIComponent(params.query)}${repoFilter}&per_page=10`);
						if (!data.items?.length) return ok(`No code results for: ${params.query}`);
						return ok(data.items.map((i: any) => `${i.repository.full_name}/${i.path}\n  ${i.html_url}`).join("\n\n"), { total: data.total_count });
					}
					case "search_repos": {
						if (!params.query) return err("query required");
						const data = await ghGet(`/search/repositories?q=${encodeURIComponent(params.query)}&per_page=10`);
						if (!data.items?.length) return ok(`No repos found for: ${params.query}`);
						return ok(data.items.map((r: any) => `${r.full_name} ⭐${r.stargazers_count}\n  ${r.description || "(no description)"}\n  ${r.html_url}`).join("\n\n"), { total: data.total_count });
					}
					default: return err(`Unknown action: ${params.action}`);
				}
			} catch (err: unknown) { return err(`GitHub API error: ${err instanceof Error ? err.message : String(err)}`); }
		},
	});
}

function formatIssue(issue: any): string {
	const labels = issue.labels?.map((l: any) => l.name).join(", ") || "";
	return `#${issue.number} ${issue.title}${labels ? ` [${labels}]` : ""}\n  State: ${issue.state} | Created: ${issue.created_at}\n  ${issue.html_url}`;
}
function formatPR(pr: any): string {
	return `#${pr.number} ${pr.title}\n  State: ${pr.state} | Draft: ${pr.draft} | Created: ${pr.created_at}\n  ${pr.html_url}`;
}
function ok(text: string, details?: Record<string, unknown>) { return { content: [{ type: "text" as const, text }], details }; }
function err(text: string) { return { content: [{ type: "text" as const, text: `Error: ${text}` }], details: { error: text } }; }
function truncate(text: string, maxLen: number): string { return text.length <= maxLen ? text : text.slice(0, maxLen) + `\n... [truncated ${text.length - maxLen} chars]`; }

export default registerGithub;
