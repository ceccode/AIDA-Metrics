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

program.parse();
