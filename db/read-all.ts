type Page<T> = { data: T[] | null; error: unknown; count: number | null };

/** Complete, deterministically ordered reads. A failed/inconsistent page is not an empty result. */
export async function readAllRows<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
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
    for (const row of page.data) {
      if (!row.id || ids.has(row.id)) throw new Error("History changed during read");
      ids.add(row.id); rows.push(row);
    }
    if (rows.length > expected) throw new Error("History changed during read");
  } while (rows.length < expected);
  return rows;
}
