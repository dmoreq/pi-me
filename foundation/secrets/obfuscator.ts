import type { SecretEntry } from "./types";
import { compileSecretRegex } from "./regex";
import * as crypto from "node:crypto";

const REPLACEMENT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateDeterministicReplacement(secret: string): string {
	const hash = crypto.createHash("sha256").update(secret).digest();
	const chars: string[] = [];
	for (let i = 0; i < secret.length; i++) {
		const idx = hash[i % hash.length] % REPLACEMENT_CHARS.length;
		chars.push(REPLACEMENT_CHARS[idx]);
	}
	return chars.join("");
}

const HASH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const HASH_LEN = 4;

function simpleHash(str: string, seed: number): number {
	let h = seed;
	for (let i = 0; i < str.length; i++) {
		h = ((h << 5) - h + str.charCodeAt(i)) | 0;
	}
	return h;
}

function buildPlaceholder(index: number): string {
	let v = simpleHash(String(index), 0x5345_4352);
	let tag = "#";
	for (let i = 0; i < HASH_LEN; i++) {
		tag += HASH_CHARS[Math.abs(v % HASH_CHARS.length)];
		v = Math.floor(v / HASH_CHARS.length);
	}
	return `${tag}#`;
}

const PLACEHOLDER_RE = /#[A-Z0-9]{4}#/g;

function replaceAll(text: string, search: string, replacement: string): string {
	if (search.length === 0) return text;
	let result = text;
	let idx = result.indexOf(search);
	while (idx !== -1) {
		result = result.slice(0, idx) + replacement + result.slice(idx + search.length);
		idx = result.indexOf(search, idx + replacement.length);
	}
	return result;
}

function deepWalkStrings<T>(obj: T, transform: (s: string) => string): T {
	if (typeof obj === "string") {
		return transform(obj) as unknown as T;
	}
	if (Array.isArray(obj)) {
		let changed = false;
		const result = obj.map((item) => {
			const transformed = deepWalkStrings(item, transform);
			if (transformed !== item) changed = true;
			return transformed;
		});
		return (changed ? result : obj) as unknown as T;
	}
	if (obj !== null && typeof obj === "object") {
		let changed = false;
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(obj)) {
			const value = (obj as Record<string, unknown>)[key];
			const transformed = deepWalkStrings(value, transform);
			if (transformed !== value) changed = true;
			result[key] = transformed;
		}
		return (changed ? result : obj) as T;
	}
	return obj;
}

export class SecretObfuscator {
	#plainMappings = new Map<string, number>();
	#regexEntries: Array<{ regex: RegExp; mode: "obfuscate" | "replace"; replacement?: string }> = [];
	#obfuscateMappings = new Map<number, { secret: string; placeholder: string }>();
	#replaceMappings = new Map<string, string>();
	#deobfuscateMap = new Map<string, string>();
	#nextIndex: number;
	#hasAny: boolean;

	constructor(entries: SecretEntry[]) {
		let index = 0;
		for (const entry of entries) {
			const mode = entry.mode ?? "obfuscate";

			if (entry.type === "plain") {
				if (mode === "obfuscate") {
					const placeholder = buildPlaceholder(index);
					this.#plainMappings.set(entry.content, index);
					this.#obfuscateMappings.set(index, { secret: entry.content, placeholder });
					this.#deobfuscateMap.set(placeholder, entry.content);
					index++;
				} else {
					const replacement = entry.replacement ?? generateDeterministicReplacement(entry.content);
					this.#replaceMappings.set(entry.content, replacement);
				}
			} else {
				try {
					const regex = compileSecretRegex(entry.content, entry.flags);
					this.#regexEntries.push({ regex, mode, replacement: entry.replacement });
				} catch {
					// Invalid regex — skip silently
				}
			}
		}

		this.#nextIndex = index;
		this.#hasAny = entries.length > 0;
	}

	hasSecrets(): boolean {
		return this.#hasAny;
	}

	obfuscate(text: string): string {
		if (!this.#hasAny) return text;
		let result = text;

		for (const [secret, replacement] of [...this.#replaceMappings].sort((a, b) => b[0].length - a[0].length)) {
			result = replaceAll(result, secret, replacement);
		}

		for (const [secret, index] of [...this.#plainMappings].sort((a, b) => b[0].length - a[0].length)) {
			const mapping = this.#obfuscateMappings.get(index)!;
			result = replaceAll(result, secret, mapping.placeholder);
		}

		for (const entry of this.#regexEntries) {
			entry.regex.lastIndex = 0;
			const matches = new Set<string>();
			for (;;) {
				const match = entry.regex.exec(result);
				if (match === null) break;
				if (match[0].length === 0) {
					entry.regex.lastIndex++;
					continue;
				}
				matches.add(match[0]);
			}

			for (const matchValue of matches) {
				if (entry.mode === "replace") {
					const replacement = entry.replacement ?? generateDeterministicReplacement(matchValue);
					result = replaceAll(result, matchValue, replacement);
				} else {
					let index = this.#findObfuscateIndex(matchValue);
					if (index === undefined) {
						index = this.#nextIndex++;
						const placeholder = buildPlaceholder(index);
						this.#obfuscateMappings.set(index, { secret: matchValue, placeholder });
						this.#deobfuscateMap.set(placeholder, matchValue);
					}
					const mapping = this.#obfuscateMappings.get(index)!;
					result = replaceAll(result, matchValue, mapping.placeholder);
				}
			}
		}

		return result;
	}

	deobfuscate(text: string): string {
		if (!this.#hasAny || !text.includes("#")) return text;
		return text.replace(PLACEHOLDER_RE, (match) => {
			return this.#deobfuscateMap.get(match) ?? match;
		});
	}

	deobfuscateObject<T>(obj: T): T {
		if (!this.#hasAny) return obj;
		return deepWalkStrings(obj, (s) => this.deobfuscate(s));
	}

	#findObfuscateIndex(secret: string): number | undefined {
		const plainIndex = this.#plainMappings.get(secret);
		if (plainIndex !== undefined) return plainIndex;

		for (const [index, mapping] of this.#obfuscateMappings) {
			if (mapping.secret === secret) return index;
		}
		return undefined;
	}
}
