export function detectWorkflowIntent(text: string): string { return text.includes("build") ? "build" : "general"; }
