type Page<T> = { data: T[] | null; error: unknown; count: number | null };

export class ReadLimitExceededError extends Error {
  readonly limit: number;
  readonly actual: number;

  constructor(limit: number, actual: number) {
    super(`Read limit ${limit} exceeded by exact count ${actual}`);
    this.name = "ReadLimitExceededError";
    this.limit = limit;
    this.actual = actual;
  }
}

/** Complete, deterministically ordered reads. A failed/inconsistent page is not an empty result. */
export async function readAllRows<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  maxRows?: number,
): Promise<T[]> {
  if (maxRows !== undefined && (!Number.isSafeInteger(maxRows) || maxRows < 0)) throw new Error("Invalid row limit");
  const rows: T[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  do {
    const page = await fetchPage(rows.length, rows.length + 499);
    if (page.error) throw page.error;
    if (!Array.isArray(page.data) || page.count === null || !Number.isSafeInteger(page.count) || page.count < 0) {
      throw new Error("Incomplete history read");
    }
    expected ??= page.count;
    if (page.count !== expected || (!page.data.length && rows.length < expected)) {
      throw new Error("History changed during read");
    }
    if (maxRows !== undefined && page.count > maxRows) throw new ReadLimitExceededError(maxRows, page.count);
    for (const row of page.data) {
      if (!row.id || ids.has(row.id)) throw new Error("History changed during read");
      ids.add(row.id); rows.push(row);
    }
    if (rows.length > expected) throw new Error("History changed during read");
  } while (rows.length < expected);
  return rows;
}
