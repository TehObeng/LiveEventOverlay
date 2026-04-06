import 'server-only';

import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { DEFAULT_OVERLAY_CONFIG, EventData, Message, SiteContent } from '@/lib/types';
import {
  DEFAULT_E2E_ADMIN_PASSWORD,
  getE2EAdminEmail,
  getE2EAdminPassword,
  getE2EEventId,
  getE2EEventName,
  MOCK_SESSION_COOKIE,
} from '@/lib/e2e-config';
import { normalizeOverlayConfig } from '@/lib/public';
import { ServiceRoleSupabaseClientLike } from '@/lib/supabase-like';

const MOCK_ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const STORE_FILE_PATH = path.join(process.cwd(), 'data', 'local-db.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type TableName = 'events' | 'messages' | 'admin_users' | 'site_content';
type MockResult = {
  data: unknown;
  error: { message: string } | null;
};

type MockDatabaseState = {
  events: EventData[];
  messages: Message[];
  admin_users: Array<{
    user_id: string;
    email: string;
    password_hash: string;
    is_active: boolean;
    role: 'admin';
  }>;
  sessions: Array<{
    token: string;
    user_id: string;
    expires_at: string;
  }>;
  site_content: Array<{ key: string; content: SiteContent; updated_by: string | null }>;
};

type Filter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'in'; column: string; value: unknown[] }
  | { type: 'gt'; column: string; value: unknown };

type OrderBy = {
  column: string;
  ascending: boolean;
};

declare global {
  var __LIVE_CHAT_MOCK_DB__: MockDatabaseState | undefined;
}

function createSessionSigningSecret() {
  return (
    process.env.MOCK_SESSION_SECRET ||
    process.env.LOCAL_ADMIN_PASSWORD ||
    process.env.E2E_ADMIN_PASSWORD ||
    DEFAULT_E2E_ADMIN_PASSWORD
  );
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signSessionPayload(payload: string) {
  return crypto.createHmac('sha256', createSessionSigningSecret()).update(payload).digest('base64url');
}

function createSignedSessionCookie(user: { userId: string; email: string | null }) {
  const payload = encodeBase64Url(
    JSON.stringify({
      userId: user.userId,
      email: user.email,
      expiresAt: Date.now() + SESSION_TTL_MS,
    }),
  );

  return `${payload}.${signSessionPayload(payload)}`;
}

function readSignedSessionCookie(cookieValue: string) {
  const [payload, signature] = cookieValue.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(payload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as {
      userId?: string;
      email?: string | null;
      expiresAt?: number;
    };

    if (
      typeof parsed.userId !== 'string' ||
      (typeof parsed.email !== 'string' && parsed.email !== null && typeof parsed.email !== 'undefined') ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      id: parsed.userId,
      email: parsed.email ?? null,
    };
  } catch {
    return null;
  }
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, 'hex');

  if (candidate.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidate, stored);
}

function buildInitialState(): MockDatabaseState {
  const now = new Date();
  const eventId = getE2EEventId();
  const createdAt = now.toISOString();
  const event: EventData = {
    id: eventId,
    name: getE2EEventName(),
    date: new Date(now.getTime() + 86400000).toISOString(),
    max_chars: 160,
    cooldown_seconds: 3,
    overlay_config: {
      ...DEFAULT_OVERLAY_CONFIG,
      speed: 135,
      maxMessages: 12,
      fontFamily: 'Outfit',
    },
    auto_approve: true,
    is_active: true,
    created_at: createdAt,
    overlay_cleared_at: null,
  };

  const messages: Message[] = [
    {
      id: '22222222-2222-4222-8222-222222222221',
      event_id: eventId,
      text: 'Selamat datang di mode uji otomatis.',
      sender_name: 'Codex',
      status: 'approved',
      risk_level: 'safe',
      ip_hash: 'seed-approved',
      is_banned: false,
      created_at: new Date(now.getTime() - 120000).toISOString(),
      approved_at: new Date(now.getTime() - 90000).toISOString(),
      approved_by: 'auto',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      event_id: eventId,
      text: 'Pesan ini menunggu moderasi.',
      sender_name: 'Moderator',
      status: 'pending',
      risk_level: 'risky',
      ip_hash: 'seed-pending',
      is_banned: false,
      created_at: new Date(now.getTime() - 30000).toISOString(),
      approved_at: null,
      approved_by: null,
    },
  ];

  return {
    events: [event],
    messages,
    admin_users: [
      {
        user_id: MOCK_ADMIN_ID,
        email: getE2EAdminEmail(),
        password_hash: createPasswordHash(getE2EAdminPassword()),
        is_active: true,
        role: 'admin',
      },
    ],
    sessions: [],
    site_content: [],
  };
}

function persistState(state: MockDatabaseState) {
  globalThis.__LIVE_CHAT_MOCK_DB__ = state;

  try {
    mkdirSync(path.dirname(STORE_FILE_PATH), { recursive: true });
    writeFileSync(STORE_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.warn('Mock database persistence unavailable, falling back to in-memory state.', error);
  }
}

function loadStateFromDisk() {
  if (!existsSync(STORE_FILE_PATH)) {
    const state = buildInitialState();
    persistState(state);
    return state;
  }

  try {
    const raw = JSON.parse(readFileSync(STORE_FILE_PATH, 'utf8')) as Partial<MockDatabaseState>;
    const state = buildInitialState();

    if (Array.isArray(raw.events)) {
      state.events = raw.events;
    }

    if (Array.isArray(raw.messages)) {
      state.messages = raw.messages;
    }

    if (Array.isArray(raw.site_content)) {
      state.site_content = raw.site_content;
    }

    if (Array.isArray(raw.admin_users)) {
      state.admin_users = raw.admin_users
        .map((admin) => {
          if (
            !admin ||
            typeof admin.user_id !== 'string' ||
            typeof admin.email !== 'string' ||
            typeof admin.password_hash !== 'string'
          ) {
            return null;
          }

          return {
            user_id: admin.user_id,
            email: admin.email,
            password_hash: admin.password_hash,
            is_active: admin.is_active !== false,
            role: admin.role === 'admin' ? 'admin' : 'admin',
          };
        })
        .filter(
          (
            admin,
          ): admin is {
            user_id: string;
            email: string;
            password_hash: string;
            is_active: boolean;
            role: 'admin';
          } => admin !== null,
        );
    }

    if (!state.admin_users.some((admin) => admin.email.toLowerCase() === getE2EAdminEmail().toLowerCase())) {
      state.admin_users.push({
        user_id: crypto.randomUUID(),
        email: getE2EAdminEmail(),
        password_hash: createPasswordHash(getE2EAdminPassword()),
        is_active: true,
        role: 'admin',
      });
    }

    if (Array.isArray(raw.sessions)) {
      state.sessions = raw.sessions.filter((session) => {
        return (
          session &&
          typeof session.token === 'string' &&
          typeof session.user_id === 'string' &&
          typeof session.expires_at === 'string' &&
          Date.parse(session.expires_at) > Date.now()
        );
      });
    }

    persistState(state);
    return state;
  } catch {
    const state = buildInitialState();
    persistState(state);
    return state;
  }
}

function getState() {
  if (!globalThis.__LIVE_CHAT_MOCK_DB__) {
    globalThis.__LIVE_CHAT_MOCK_DB__ = loadStateFromDisk();
  }

  return globalThis.__LIVE_CHAT_MOCK_DB__;
}

export function resetMockDatabase() {
  globalThis.__LIVE_CHAT_MOCK_DB__ = buildInitialState();
  persistState(globalThis.__LIVE_CHAT_MOCK_DB__);
  return cloneValue(globalThis.__LIVE_CHAT_MOCK_DB__);
}

function pickFields(row: Record<string, unknown>, select: string) {
  if (select === '*' || !select.trim()) {
    return cloneValue(row);
  }

  const nextRow: Record<string, unknown> = {};
  for (const field of select.split(',').map((value) => value.trim()).filter(Boolean)) {
    nextRow[field] = row[field];
  }

  return nextRow;
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: Filter[]) {
  return rows.filter((row) =>
    filters.every((filter) => {
      const current = row[filter.column];
      switch (filter.type) {
        case 'eq':
          return current === filter.value;
        case 'in':
          return filter.value.includes(current);
        case 'gt':
          return String(current ?? '') > String(filter.value ?? '');
      }
    }),
  );
}

function createEventRecord(input: Record<string, unknown>): EventData {
  return {
    id: typeof input.id === 'string' ? input.id : crypto.randomUUID(),
    name: typeof input.name === 'string' ? input.name : 'Untitled Event',
    date:
      typeof input.date === 'string' && input.date
        ? input.date
        : new Date(Date.now() + 86400000).toISOString(),
    max_chars: typeof input.max_chars === 'number' ? input.max_chars : 100,
    cooldown_seconds:
      typeof input.cooldown_seconds === 'number' ? input.cooldown_seconds : 10,
    overlay_config: normalizeOverlayConfig(
      (input.overlay_config as Partial<EventData['overlay_config']> | undefined) ??
        DEFAULT_OVERLAY_CONFIG,
    ),
    auto_approve: typeof input.auto_approve === 'boolean' ? input.auto_approve : true,
    is_active: typeof input.is_active === 'boolean' ? input.is_active : true,
    created_at:
      typeof input.created_at === 'string' ? input.created_at : new Date().toISOString(),
    overlay_cleared_at:
      typeof input.overlay_cleared_at === 'string' ? input.overlay_cleared_at : null,
  };
}

function createMessageRecord(input: Record<string, unknown>): Message {
  return {
    id: typeof input.id === 'string' ? input.id : crypto.randomUUID(),
    event_id: String(input.event_id || getE2EEventId()),
    text: typeof input.text === 'string' ? input.text : '',
    sender_name: typeof input.sender_name === 'string' ? input.sender_name : null,
    status:
      input.status === 'approved' || input.status === 'rejected' ? input.status : 'pending',
    risk_level:
      input.risk_level === 'safe' || input.risk_level === 'risky'
        ? input.risk_level
        : null,
    ip_hash: typeof input.ip_hash === 'string' ? input.ip_hash : null,
    is_banned: typeof input.is_banned === 'boolean' ? input.is_banned : false,
    created_at:
      typeof input.created_at === 'string' ? input.created_at : new Date().toISOString(),
    approved_at: typeof input.approved_at === 'string' ? input.approved_at : null,
    approved_by: typeof input.approved_by === 'string' ? input.approved_by : null,
  };
}

class MockQueryBuilder implements PromiseLike<MockResult> {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';

  private filters: Filter[] = [];

  private selection = '*';

  private orderBy: OrderBy | null = null;

  private rowLimit: number | null = null;

  private returnSingle = false;
  private returnMaybeSingle = false;

  private payload: unknown = null;

  constructor(private readonly table: TableName) {}

  select(selection = '*') {
    this.selection = selection;
    return this;
  }

  insert(payload: unknown) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: 'in', column, value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending !== false,
    };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.returnSingle = true;
    return this;
  }

  maybeSingle() {
    this.returnMaybeSingle = true;
    return this;
  }

  upsert(payload: unknown, options?: { onConflict?: string }) {
    this.action = 'insert';
    this.payload = payload;
    if (options?.onConflict === 'key') {
      this.filters = [];
    }
    return this;
  }

  private getTableRows(): unknown[] {
    const state = getState();
    return state[this.table] as unknown[];
  }

  private setTableRows(nextRows: unknown[]) {
    const state = getState();
    if (this.table === 'events') {
      state.events = nextRows as EventData[];
      persistState(state);
      return;
    }
    if (this.table === 'messages') {
      state.messages = nextRows as Message[];
      persistState(state);
      return;
    }
    if (this.table === 'admin_users') {
      state.admin_users = nextRows as MockDatabaseState['admin_users'];
      persistState(state);
      return;
    }
    state.site_content = nextRows as MockDatabaseState['site_content'];
    persistState(state);
  }

  private executeSelect() {
    let rows = applyFilters(this.getTableRows() as Record<string, unknown>[], this.filters);

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((left, right) => {
        const a = left[column];
        const b = right[column];
        if (a === b) {
          return 0;
        }

        return ascending ? (String(a) > String(b) ? 1 : -1) : String(a) > String(b) ? -1 : 1;
      });
    }

    if (this.rowLimit !== null) {
      rows = rows.slice(0, this.rowLimit);
    }

    const selected = rows.map((row) => pickFields(row, this.selection));
    if (!this.returnSingle && !this.returnMaybeSingle) {
      return {
        data: cloneValue(selected),
        error: null,
      };
    }

    const first = selected[0] ?? null;
    if (this.returnMaybeSingle) {
      return { data: cloneValue(first), error: null };
    }
    return first
      ? { data: cloneValue(first), error: null }
      : { data: null, error: { message: 'No rows found' } };
  }

  private executeInsert() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    let nextRows: unknown[];
    const currentRows = [...this.getTableRows()] as Record<string, unknown>[];
    if (this.table === 'events') {
      nextRows = rows.map((row) => createEventRecord(row as Record<string, unknown>));
      this.setTableRows([...currentRows, ...nextRows]);
    } else if (this.table === 'messages') {
      nextRows = rows.map((row) => createMessageRecord(row as Record<string, unknown>));
      this.setTableRows([...currentRows, ...nextRows]);
    } else if (this.table === 'site_content') {
      const incoming = rows.map((row) => row as Record<string, unknown>);
      for (const item of incoming) {
        const existingIndex = currentRows.findIndex((entry) => entry.key === item.key);
        const normalized = {
          key: String(item.key || 'landing_page'),
          content: (item.content || {}) as SiteContent,
          updated_by: typeof item.updated_by === 'string' ? item.updated_by : null,
        };
        if (existingIndex >= 0) {
          currentRows[existingIndex] = { ...currentRows[existingIndex], ...normalized };
        } else {
          currentRows.push(normalized);
        }
      }
      nextRows = incoming;
      this.setTableRows(currentRows);
    } else {
      nextRows = rows.map((row) => row as Record<string, unknown>);
      this.setTableRows([...currentRows, ...nextRows]);
    }

    if (this.selection === '*' || this.selection) {
      const selected = nextRows.map((row) =>
        pickFields(row as unknown as Record<string, unknown>, this.selection),
      );
      if (this.returnSingle) {
        return {
          data: cloneValue(selected[0] ?? null),
          error: selected[0] ? null : { message: 'No rows found' },
        };
      }

      return {
        data: cloneValue(selected),
        error: null,
      };
    }

    return {
      data: null,
      error: null,
    };
  }

  private executeUpdate() {
    const rows = [...this.getTableRows()] as Record<string, unknown>[];
    const matches = applyFilters(rows, this.filters);
    const updatePayload = (this.payload ?? {}) as Record<string, unknown>;
    const updatedIds = new Set(matches.map((row) => String(row.id)));

    const nextRows = rows.map((row) => {
      if (!updatedIds.has(String(row.id))) {
        return row;
      }

      const nextRow = {
        ...row,
        ...updatePayload,
      };

      if (this.table === 'events') {
        return {
          ...nextRow,
          overlay_config: normalizeOverlayConfig(
            nextRow.overlay_config as Partial<EventData['overlay_config']> | undefined,
          ),
        };
      }

      return nextRow;
    });

    this.setTableRows(nextRows as unknown[]);

    if (this.selection === '*' || this.selection) {
      const selected = nextRows
        .filter((row) => updatedIds.has(String(row.id)))
        .map((row) => pickFields(row, this.selection));
      if (this.returnSingle) {
        return {
          data: cloneValue(selected[0] ?? null),
          error: selected[0] ? null : { message: 'No rows found' },
        };
      }

      return {
        data: cloneValue(selected),
        error: null,
      };
    }

    return {
      data: null,
      error: null,
    };
  }

  private executeDelete() {
    const rows = [...this.getTableRows()] as Record<string, unknown>[];
    const matches = applyFilters(rows, this.filters);
    const matchIds = new Set(matches.map((row) => String(row.id)));
    const nextRows = rows.filter((row) => !matchIds.has(String(row.id)));
    this.setTableRows(nextRows as unknown[]);
    return {
      data: null,
      error: null,
    };
  }

  private execute() {
    switch (this.action) {
      case 'insert':
        return this.executeInsert();
      case 'update':
        return this.executeUpdate();
      case 'delete':
        return this.executeDelete();
      default:
        return this.executeSelect();
    }
  }

  then<TResult1 = MockResult, TResult2 = never>(
    onfulfilled?:
      | ((value: MockResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export function createMockServiceRoleClient(): ServiceRoleSupabaseClientLike {
  return {
    from(table: TableName) {
      return new MockQueryBuilder(table);
    },
  };
}

export function getMockAdminUserFromCookie(cookieValue: string | null | undefined) {
  if (!cookieValue) {
    return null;
  }

  return readSignedSessionCookie(cookieValue);
}

function createAuthCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function createMockSessionResponse(
  payload: Record<string, unknown>,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);
  const user = payload.user as { userId?: string; email?: string | null } | undefined;

  if (typeof user?.userId === 'string') {
    response.cookies.set(
      MOCK_SESSION_COOKIE,
      createSignedSessionCookie({
        userId: user.userId,
        email: user.email ?? null,
      }),
      createAuthCookieOptions(),
    );
  }

  return response;
}

export function clearMockSessionResponse(cookieValue: string | undefined, payload: Record<string, unknown>) {
  const response = NextResponse.json(payload);
  response.cookies.set(MOCK_SESSION_COOKIE, '', {
    ...createAuthCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}

export function validateMockLogin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = getState().admin_users.find((item) => item.email.toLowerCase() === normalizedEmail && item.is_active);

  if (!admin) {
    return false;
  }

  return verifyPassword(password, admin.password_hash);
}
