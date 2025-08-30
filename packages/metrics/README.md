# @aida/metrics

Metrics calculation for AIDA (AI Development Accounting).

## Features

- **Merge Ratio**: Percentage of AI-tagged commits merged into default branch
- **Persistence**: File-level survival time analysis for AI-modified files
- Configurable time windows and aggregation buckets

## Usage

```typescript
import { calculateMetrics } from '@aida/metrics';

const metrics = calculateMetrics(commitStream);
console.log(`Merge ratio: ${metrics.mergeRatio.mergeRatio * 100}%`);
console.log(`Avg persistence: ${metrics.persistence.avgDays} days`);
```

## Metrics

### Merge Ratio
Tracks what percentage of AI-tagged commits make it into the default branch history.

### Persistence (MVP)
File-level proxy for how long AI-modified files survive before being changed again. Buckets: 0-1d, 2-7d, 8-30d, 31-90d, 90d+.
