import assert from 'node:assert/strict';

import { fetchAllPages } from './all-pages';

type Row = { id: string };

/** A fake list endpoint: newest-first rows, `limit` per page, like the server's paginated lists. */
function fakeServer(rows: Row[]) {
  const urls: string[] = [];
  const fetchPage = async (url: string) => {
    urls.push(url);
    const q = new URLSearchParams(url.split('?')[1]);
    const limit = Number(q.get('limit'));
    const page = Number(q.get('page'));
    return {
      results: rows.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    };
  };
  return { urls, fetchPage };
}

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));

async function main() {
  // 529 items: the old single request saw only the first 100, so search missed the other 429.
  const server = fakeServer(rows(529));
  const all = await fetchAllPages<Row>('/items?is_active=true', server.fetchPage);
  assert.equal(all.results.length, 529, 'every page is fetched');
  assert.equal(all.total, 529);
  assert.equal(all.results[528].id, 'r528', 'the oldest item is reachable');
  assert.equal(server.urls.length, 6);
  assert.equal(server.urls[0], '/items?is_active=true&limit=100&page=1', 'keeps the caller’s filters');

  // One page: one request.
  const small = fakeServer(rows(7));
  assert.equal((await fetchAllPages<Row>('/items', small.fetchPage)).results.length, 7);
  assert.deepEqual(small.urls, ['/items?limit=100&page=1'], 'adds a ? when there is no query yet');

  // Empty list.
  assert.equal((await fetchAllPages<Row>('/items', fakeServer([]).fetchPage)).results.length, 0);

  // An item created while paging shifts every row down one, so a row shows up on two pages: kept once.
  let calls = 0;
  const shifting = async (url: string) => {
    calls++;
    const page = Number(new URLSearchParams(url.split('?')[1]).get('page'));
    const list = calls === 1 ? rows(150) : [{ id: 'new' }, ...rows(150)];
    return {
      results: list.slice((page - 1) * 100, page * 100),
      page,
      limit: 100,
      total: list.length,
      totalPages: 2,
    };
  };
  const dedup = await fetchAllPages<Row>('/items', shifting);
  assert.equal(new Set(dedup.results.map((r) => r.id)).size, dedup.results.length, 'no duplicates');

  console.log('all-pages: ok');
}

void main();
