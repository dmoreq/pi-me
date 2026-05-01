/**
 * /dcp-logs command - View pi-dcp logs
 *
 * Shows recent log entries and provides information about log file locations.
 */

import type { CommandDefinition } from "../types";
import { getLogger } from "../logger";
import { readFileSync, existsSync, statSync } from "fs";

export const dcpLogsCommand: CommandDefinition = {
	description: "View pi-dcp extension logs",
	handler: async (args, ctx) => {
		const logger = getLogger();
		const parsedArgs = typeof args === 'string' ? args.split(/\s+/) : [];
		const linesToShow = parseInt(parsedArgs[0] || "50", 10) || 50;
		const fileIndex = parseInt(parsedArgs[1] || "0", 10) || 0;

		// Get all log files
		const allLogFiles = logger.getAllLogFiles();
		
		if (allLogFiles.length === 0) {
			ctx.ui.notify("No log files found. Logs will be created when extension runs.", "info");
			return;
		}

		// Validate file index
		if (fileIndex < 0 || fileIndex >= allLogFiles.length) {
			ctx.ui.notify(`Invalid file index. Available: 0 (current) to ${allLogFiles.length - 1} (oldest backup)`, "error");
			return;
		}

		const logFilePath = allLogFiles[fileIndex];
		
		if (!existsSync(logFilePath)) {
			ctx.ui.notify(`Log file not found: ${logFilePath}`, "error");
			return;
		}

		// Get file info
		const stats = statSync(logFilePath);
		const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

		// Read the file
		const content = readFileSync(logFilePath, "utf8");
		const lines = content.split("\n").filter(line => line.trim());
		
		// Get last N lines
		const recentLines = lines.slice(-linesToShow);

		// Build response
		let response = `📋 **pi-dcp Logs**\n\n`;
		response += `**File:** \`${logFilePath}\`\n`;
		response += `**Size:** ${fileSizeMB} MB\n`;
		response += `**Total Lines:** ${lines.length}\n`;
		response += `**Showing:** Last ${recentLines.length} lines\n\n`;
		response += "---\n\n";
		response += "```\n";
		response += recentLines.join("\n");
		response += "\n```\n\n";
		
		// Show available files
		if (allLogFiles.length > 1) {
			response += "\n**Available log files:**\n";
			allLogFiles.forEach((file, idx) => {
				const size = existsSync(file) ? (statSync(file).size / (1024 * 1024)).toFixed(2) : "0";
				const label = idx === 0 ? "current" : `backup ${idx}`;
				response += `- ${idx}: ${label} (${size} MB)\n`;
			});
			response += "\nUse `/dcp-logs <lines> <file_index>` to view a specific file.";
		}

		ctx.ui.notify(response, "info");
	},
};
