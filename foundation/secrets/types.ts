/** Shared types for pi-secrets. */

export interface SecretEntry {
	type: "plain" | "regex";
	content: string;
	mode?: "obfuscate" | "replace";
	replacement?: string;
	flags?: string;
}

export interface SecretsConfig {
	sourcePath?: string;
	entries: SecretEntry[];
	hasSecrets: boolean;
}
