export function parseRelativeDate(input: string): Date {
  const now = new Date();

  // Handle ISO dates
  if (input.includes('-') || input.includes('T')) {
    return new Date(input);
  }

  // Handle relative dates like "90d", "30d", etc.
  const match = input.match(/^(\d+)([dwmy])$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

    const result = new Date(now);

    switch (unit) {
      case 'd':
        result.setDate(result.getDate() - value);
        break;
      case 'w':
        result.setDate(result.getDate() - value * 7);
        break;
      case 'm':
        result.setMonth(result.getMonth() - value);
        break;
      case 'y':
        result.setFullYear(result.getFullYear() - value);
        break;
    }

    return result;
  }

  throw new Error(`Invalid date format: ${input}`);
}

export function formatISODate(date: Date): string {
  return date.toISOString();
}

export function daysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
