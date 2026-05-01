export interface ProtectedGlob {
	glob: string;
	reason: string;
}

export const DEFAULT_PROTECTED_PATHS: ProtectedGlob[] = [
	{ glob: ".env", reason: "Environment file — may contain secrets" },
	{ glob: ".env.*", reason: "Environment file — may contain secrets" },
	{ glob: ".envrc", reason: "direnv config — may contain secrets" },
	{ glob: "**/*.pem", reason: "PEM certificate/key file" },
	{ glob: "**/*-key.pem", reason: "Private key file" },
	{ glob: "**/id_rsa*", reason: "SSH private key" },
	{ glob: "**/id_ed25519*", reason: "SSH private key" },
	{ glob: "**/id_ecdsa*", reason: "SSH private key" },
	{ glob: "**/*.key", reason: "Private key file" },
	{ glob: ".pypirc", reason: "PyPI credentials" },
	{ glob: ".npmrc", reason: "npm credentials" },
	{ glob: ".gemrc", reason: "RubyGems credentials" },
	{ glob: "**/.cargo/credentials.toml", reason: "Cargo registry credentials" },
	{ glob: "**/secrets.yml", reason: "Secret definitions" },
	{ glob: "**/.secrets.yml", reason: "Secret definitions" },
	{ glob: ".git/config", reason: "Git configuration — should not be modified by agent" },
	{ glob: ".gitignore", reason: "Git ignore rules — should not be modified by agent" },
	{ glob: "**/package-lock.json", reason: "Package lock file — use npm/yarn/pnpm commands instead" },
	{ glob: "**/yarn.lock", reason: "Package lock file — use yarn commands instead" },
	{ glob: "**/pnpm-lock.yaml", reason: "Package lock file — use pnpm commands instead" },
	{ glob: "**/Gemfile.lock", reason: "Package lock file — use bundler commands instead" },
	{ glob: "**/Cargo.lock", reason: "Package lock file — use cargo commands instead" },
	{ glob: "**/poetry.lock", reason: "Package lock file — use poetry commands instead" },
	{ glob: "**/Pipfile.lock", reason: "Package lock file — use pipenv commands instead" },
	{ glob: "**/.ssh/config", reason: "SSH configuration — should not be modified by agent" },
	{ glob: "**/.gnupg/**", reason: "GPG keyring — should not be modified by agent" },
	{ glob: "**/.github/workflows/*.yml", reason: "CI workflow — should not be modified by agent" },
	{ glob: "**/.github/workflows/*.yaml", reason: "CI workflow — should not be modified by agent" },
];

const _globCache = new Map<string, RegExp>();

export function matchesGlob(relativePath: string, glob: string): boolean {
	const normalized = relativePath.replace(/\\/g, "/");
	const globNormalized = glob.replace(/\\/g, "/");

	let regex = _globCache.get(globNormalized);
	if (!regex) {
		regex = new RegExp(`^${globToRegex(globNormalized)}$`);
		_globCache.set(globNormalized, regex);
	}
	return regex.test(normalized);
}

function globToRegex(glob: string): string {
	let result = "";
	let i = 0;

	while (i < glob.length) {
		const ch = glob[i];

		if (ch === "*" && glob[i + 1] === "*") {
			if (glob[i + 2] === "/") {
				result += "(?:.*/)?";
				i += 3;
			} else if (i + 2 === glob.length) {
				result += ".*";
				i += 2;
			} else {
				result += "[^/]*";
				i += 1;
			}
		} else if (ch === "*") {
			result += "[^/]*";
			i += 1;
		} else if (ch === "?") {
			result += "[^/]";
			i += 1;
		} else if (ch === ".") {
			result += "\\.";
			i += 1;
		} else if ("(){}[]+^$|\\".includes(ch)) {
			result += "\\" + ch;
			i += 1;
		} else {
			result += ch;
			i += 1;
		}
	}

	return result;
}
