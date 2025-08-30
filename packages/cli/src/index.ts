#!/usr/bin/env node

import { Command } from 'commander';
import { createCollectCommand } from './commands/collect.js';
import { createAnalyzeCommand } from './commands/analyze.js';
import { createReportCommand } from './commands/report.js';

const program = new Command();

program
  .name('aida')
  .description('AIDA (AI Development Accounting) - Metrics for AI-assisted development')
  .version('0.0.0');

// Add commands
program.addCommand(createCollectCommand());
program.addCommand(createAnalyzeCommand());
program.addCommand(createReportCommand());

// Global options
program
  .option('--repo <path>', 'Repository path (default: current directory)')
  .option('--since <date>', 'Start date (ISO or relative like 90d)')
  .option('--until <date>', 'End date (ISO or relative)')
  .option('--ai-pattern <pattern>', 'AI detection pattern (repeatable)')
  .option('--default-branch <name>', 'Default branch name (auto-detect if omitted)')
  .option('--out-dir <path>', 'Output directory (default: ./aida-output)')
  .option('--format <format>', 'Output format: json, md, both (default: both)')
  .option('--verbose', 'Verbose logging');

program.parse();
