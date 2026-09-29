export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * What a gateway handler returns for a paged list — `ResponseValidationInterceptor`
 * validates `.items` against the route's list schema, and `ResponseEnvelopeInterceptor`
 * turns it into `{ data: items, meta }` (conventions §6.1). The constructor is private
 * so a handler can only build one through `Paged.page`, never assemble a look-alike
 * plain object the interceptors would miss.
 */
export class Paged<T> {
  private constructor(
    public readonly items: T[],
    public readonly meta: PageMeta,
  ) {}

  static page<T>(items: T[], meta: PageMeta): Paged<T> {
    return new Paged(items, meta);
  }
}
