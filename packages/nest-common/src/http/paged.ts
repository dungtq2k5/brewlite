export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** A customer list that grows without bound — api-endpoints-plan §0.4's cursor style. */
export interface CursorMeta {
  nextCursor: string | null;
}

/**
 * What a gateway handler returns for a paged or cursor list — `ResponseValidationInterceptor`
 * validates `.items` against the route's list schema, and `ResponseEnvelopeInterceptor`
 * turns it into `{ data: items, meta }` (conventions §6.1). The constructor is private
 * so a handler can only build one through `Paged.page`/`Paged.cursor`, never assemble a
 * look-alike plain object the interceptors would miss.
 */
export class Paged<T, M = PageMeta> {
  private constructor(
    public readonly items: T[],
    public readonly meta: M,
  ) {}

  static page<T>(items: T[], meta: PageMeta): Paged<T, PageMeta> {
    return new Paged(items, meta);
  }

  static cursor<T>(items: T[], meta: CursorMeta): Paged<T, CursorMeta> {
    return new Paged(items, meta);
  }

  /** Rebuilds with the same `meta`, a different `items` — for the validation interceptor. */
  withItems<U>(items: U[]): Paged<U, M> {
    return new Paged(items, this.meta);
  }
}
