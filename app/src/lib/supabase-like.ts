export type AuthErrorLike = {
  message: string;
};

export type BrowserUserLike = {
  id: string;
  email?: string | null;
};

export type BrowserSessionLike = {
  user: BrowserUserLike;
};

export interface BrowserAuthLike {
  getUser(): Promise<{
    data: { user: BrowserUserLike | null };
    error: AuthErrorLike | null;
  }>;
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{
    data: { user: BrowserUserLike | null; session: BrowserSessionLike | null };
    error: AuthErrorLike | null;
  }>;
  signOut(): Promise<{ error: AuthErrorLike | null }>;
  onAuthStateChange(
    callback: (event: string, session: BrowserSessionLike | null) => void,
  ): {
    data: {
      subscription: {
        unsubscribe(): void;
      };
    };
  };
}

export interface BrowserSupabaseClientLike {
  auth: BrowserAuthLike;
}

export type QueryResultLike = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

export interface QueryBuilderLike extends PromiseLike<QueryResultLike> {
  select(selection?: string): QueryBuilderLike;
  insert(payload: unknown): QueryBuilderLike;
  update(payload: unknown): QueryBuilderLike;
  delete(): QueryBuilderLike;
  eq(column: string, value: unknown): QueryBuilderLike;
  in(column: string, value: unknown[]): QueryBuilderLike;
  gt(column: string, value: unknown): QueryBuilderLike;
  order(column: string, options?: { ascending?: boolean }): QueryBuilderLike;
  limit(value: number): QueryBuilderLike;
  single(): QueryBuilderLike;
  maybeSingle(): QueryBuilderLike;
  upsert(payload: unknown, options?: { onConflict?: string }): QueryBuilderLike;
}

export interface ServiceRoleSupabaseClientLike {
  from(table: string): QueryBuilderLike;
}
