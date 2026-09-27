/**
 * Shared by server and client — the generated types and the runtime loader must agree
 * (§5.4). `enums: 'String'` pairs with ts-proto's `stringEnums=true`, `longs: String`
 * with `forceLong=string`, `oneofs: false` per conventions §5.1.
 */
export const PROTO_LOADER_OPTIONS = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: false,
} as const;
