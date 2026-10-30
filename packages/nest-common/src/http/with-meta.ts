/**
 * A single resource that also carries `meta` — `{ data, meta }` instead of `{ data }`.
 * Used only when there is something to say (a degraded composition); a handler returns the
 * bare value otherwise. Like `Paged`, the constructor is private so the interceptors never
 * miss a look-alike object.
 */
export class WithMeta<T, M> {
  private constructor(
    public readonly data: T,
    public readonly meta: M,
  ) {}

  static of<T, M>(data: T, meta: M): WithMeta<T, M> {
    return new WithMeta(data, meta);
  }
}
