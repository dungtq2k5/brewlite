/**
 * What the stream route's answer says about the page. `204` (the order is final), `401` (signed
 * out), `403` (lost the permission) and `404` change what the page should show — re-read it; anything
 * else (`0` for no answer, `502`…) is the API being down, and a re-read would fail in the layout.
 */
export const pageChangedBy = (status: number): boolean =>
  status === 204 || status === 401 || status === 403 || status === 404;
