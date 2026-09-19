import type { CommitStream } from '@evidtrail/core';

// Where observation stops.
//
// Every censoring decision in this package — "this file was never touched
// again", "this period has had its full window" — is made against an end of
// observation. That end used to be the moment the stream was generated,
// which is right for a full-history run and wrong for a bounded one: with
// `--until 2 Jan`, a file added on 1 Jan and edited on 4 Jan was reported
// as having survived a 7-day window untouched (0%), because the edit was
// cut out of the stream while the clock kept running to September. The same
// slip let a truncated month pass the trend's maturity gate. Both errors
// flatter the repository.
//
// Observation cannot extend past the last instant git was asked about. The
// stream carries that instant (resolved at collect time, never a relative
// string), so the end is the earlier of the two. A stream produced before
// this fix may still hold the raw flag text; anything that does not parse
// as an absolute date is ignored, which reproduces the old behaviour rather
// than inventing a bound.
export function observationEndOf(stream: Pick<CommitStream, 'generatedAt' | 'until'>): Date {
  const generated = new Date(stream.generatedAt);
  if (!stream.until) return generated;
  const until = new Date(stream.until);
  if (Number.isNaN(until.getTime())) return generated;
  return until.getTime() < generated.getTime() ? until : generated;
}
