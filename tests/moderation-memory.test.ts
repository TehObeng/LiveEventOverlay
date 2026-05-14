import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRememberedModerationDecision,
  isRememberedSafePhrase,
  rememberApprovedSafePhrase,
  rememberRejectedPhrase,
} from '../src/lib/moderation-memory.ts';
import { ServiceRoleSupabaseClientLike } from '../src/lib/supabase-like.ts';

type SiteContentRow = {
  key: string;
  content: unknown;
  updated_by: string | null;
};

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

class FakeSiteContentQueryBuilder implements PromiseLike<QueryResult> {
  private action: 'select' | 'upsert' = 'select';
  private selection = '*';
  private keyFilter: string | null = null;
  private expectMaybeSingle = false;
  private payload: Record<string, unknown> | null = null;
  private readonly rows: SiteContentRow[];

  constructor(rows: SiteContentRow[]) {
    this.rows = rows;
  }

  select(selection = '*') {
    this.selection = selection;
    return this;
  }

  insert() {
    return this;
  }

  update() {
    return this;
  }

  delete() {
    return this;
  }

  eq(column: string, value: unknown) {
    if (column === 'key' && typeof value === 'string') {
      this.keyFilter = value;
    }

    return this;
  }

  in() {
    return this;
  }

  gt() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  single() {
    this.expectMaybeSingle = true;
    return this;
  }

  maybeSingle() {
    this.expectMaybeSingle = true;
    return this;
  }

  upsert(payload: unknown) {
    this.action = 'upsert';
    this.payload = payload as Record<string, unknown>;
    return this;
  }

  private pickSelection(row: SiteContentRow) {
    if (this.selection === 'content') {
      return { content: row.content };
    }

    return row;
  }

  private executeSelect(): QueryResult {
    const row = this.rows.find((item) => item.key === this.keyFilter) || null;
    const data = row ? this.pickSelection(row) : null;

    if (this.expectMaybeSingle) {
      return { data, error: null };
    }

    return { data: data ? [data] : [], error: null };
  }

  private executeUpsert(): QueryResult {
    const nextRow = {
      key: String(this.payload?.key || ''),
      content: this.payload?.content ?? {},
      updated_by: typeof this.payload?.updated_by === 'string' ? this.payload.updated_by : null,
    };

    const existingIndex = this.rows.findIndex((row) => row.key === nextRow.key);
    if (existingIndex >= 0) {
      this.rows[existingIndex] = nextRow;
    } else {
      this.rows.push(nextRow);
    }

    return { data: null, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ) {
    const result = this.action === 'upsert' ? this.executeUpsert() : this.executeSelect();
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

function createFakeClient() {
  const rows: SiteContentRow[] = [];
  const client: ServiceRoleSupabaseClientLike = {
    from(table: string) {
      if (table !== 'site_content') {
        throw new Error(`Unsupported table in test client: ${table}`);
      }

      return new FakeSiteContentQueryBuilder(rows);
    },
  };

  return {
    client,
    rows,
  };
}

test('approved risky phrases are remembered as safe by fingerprint', async () => {
  const { client } = createFakeClient();

  await rememberApprovedSafePhrase(client, 'Go... Team...', 'admin-1');

  assert.equal(await isRememberedSafePhrase(client, 'go team'), true);
  assert.equal(await getRememberedModerationDecision(client, 'GO TEAM'), 'approved');
});

test('rejected phrases override prior approval memory', async () => {
  const { client, rows } = createFakeClient();

  await rememberApprovedSafePhrase(client, 'Semangat... terus...', 'admin-1');
  await rememberRejectedPhrase(client, 'semangat terus', 'admin-2');

  assert.equal(await isRememberedSafePhrase(client, 'Semangat terus'), false);
  assert.equal(await getRememberedModerationDecision(client, 'SEMANGAT TERUS...'), 'rejected');

  const allowlist = rows.find((row) => row.key === 'moderation_allowlist');
  const blocklist = rows.find((row) => row.key === 'moderation_blocklist');

  assert.deepEqual((allowlist?.content as { entries?: unknown[] } | undefined)?.entries || [], []);
  assert.equal(
    ((blocklist?.content as { entries?: Array<{ rejected_by?: string }> } | undefined)?.entries || [])[0]
      ?.rejected_by,
    'admin-2',
  );
});

test('approving a previously rejected phrase removes the rejection memory', async () => {
  const { client } = createFakeClient();

  await rememberRejectedPhrase(client, 'Mantap banget', 'admin-1');
  await rememberApprovedSafePhrase(client, 'Mantap banget...', 'admin-2');

  assert.equal(await getRememberedModerationDecision(client, 'mantap banget'), 'approved');
  assert.equal(await isRememberedSafePhrase(client, 'Mantap banget'), true);
});
