/**
 * pi-me: safety-patterns — Hard safety net command patterns.
 *
 * These patterns are always checked, regardless of permission tier.
 * They complement the tier-based permission system with an unbypassable
 * safety layer for destructive and dangerous operations.
 */

export interface SafetyPattern {
  pattern: RegExp;
  category: string;
  description: string;
}

export const DEFAULT_SAFETY_PATTERNS: SafetyPattern[] = [
  // ── Destructive Filesystem ──
  {
    pattern: /\brm\s+(-[a-z]*r[a-z]*f?|--recursive)\b/i,
    category: "Destructive Filesystem",
    description: "Recursive delete — can wipe large directory trees",
  },
  {
    pattern: /\brm\s+(-[a-z]*f[a-z]*|--force)\b.*\/(etc|usr|var|home|opt|boot|dev|sys)\//i,
    category: "Destructive Filesystem",
    description: "Force delete targeting system directories",
  },
  {
    pattern: /\bchmod\s+.*777/i,
    category: "Insecure Permissions",
    description: "Setting world-writable permissions (777)",
  },
  {
    pattern: /\bchmod\s+-R\s+[0-7]*[67][67][67]\b/i,
    category: "Insecure Permissions",
    description: "Recursively setting world-writable permissions",
  },
  {
    pattern: /\bchown\s+-R\b/i,
    category: "Insecure Permissions",
    description: "Recursively changing file ownership",
  },
  {
    pattern: /\bmkfs\b/i,
    category: "Filesystem Destruction",
    description: "Creating a filesystem (destroys existing data)",
  },
  {
    pattern: /\bdd\s+if=.*of=\/dev\/(sd|nvme|hd|xvd)/i,
    category: "Device Overwrite",
    description: "Writing a disk image to a raw block device",
  },

  // ── Privilege Escalation ──
  {
    pattern: /\bsudo\b(?!\s+-[nhlV])/i,
    category: "Privilege Escalation",
    description: "Running command with root privileges via sudo",
  },
  {
    pattern: /\bsu\b\s+-/i,
    category: "Privilege Escalation",
    description: "Switching to another user account",
  },
  {
    pattern: /\bdoas\b/i,
    category: "Privilege Escalation",
    description: "Running command with elevated privileges via doas",
  },

  // ── Fork Bomb ──
  {
    pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    category: "Fork Bomb",
    description: "Classic fork bomb — will exhaust system resources",
  },

  // ── Pipe to Shell ──
  {
    pattern: /\bcurl\s+.*\|\s*(ba)?sh\b/i,
    category: "Pipe to Shell",
    description: "Downloading and executing a script via curl | sh",
  },
  {
    pattern: /\bwget\s+.*-O\s*-\s*\|\s*(ba)?sh\b/i,
    category: "Pipe to Shell",
    description: "Downloading and executing a script via wget | sh",
  },

  // ── Git Destructive ──
  {
    pattern: /\bgit\s+push\s+.*(--force|--force-with-lease)/i,
    category: "Git Destructive",
    description: "Force-pushing to a remote — can overwrite others' work",
  },
  {
    pattern: /\bgit\s+reset\s+--hard\b/i,
    category: "Git Destructive",
    description: "Hard reset — discards uncommitted changes permanently",
  },
  {
    pattern: /\bgit\s+clean\s+-[a-z]*f[a-z]*d[a-z]*/i,
    category: "Git Destructive",
    description: "Force-clean with directory removal — deletes untracked files and directories",
  },

  // ── Environment Leak ──
  {
    pattern: /\b(env|printenv)\s*$/i,
    category: "Environment Leak",
    description: "Printing all environment variables — may expose API keys",
  },
  {
    pattern: /\b(cat|head|tail|less)\s+\.env\b/i,
    category: "Environment Leak",
    description: "Reading .env file — may expose secrets",
  },
];
