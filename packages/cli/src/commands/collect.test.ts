import { describe, it, expect } from 'vitest';
import { createCollectCommand } from './collect.js';

describe('Collect Command', () => {
  it('should create collect command with correct options', () => {
    const command = createCollectCommand();
    
    expect(command.name()).toBe('collect');
    expect(command.description()).toBe('Collect commits and generate commit-stream.json');
    
    // Check that options are defined
    const options = command.options;
    expect(options.length).toBeGreaterThan(0);
    
    // Check for key options
    const optionNames = options.map(opt => opt.long);
    expect(optionNames).toContain('--repo');
    expect(optionNames).toContain('--since');
    expect(optionNames).toContain('--out-dir');
  });
});
