import 'server-only';
import { ApiClientError } from '@brewlite/api-client';

const safeCodes = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'ROUTE_NOT_FOUND',
  'RESOURCE_NOT_FOUND',
  'INTERNAL',
  'SERVICE_UNAVAILABLE',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ECONNRESET',
  'UND_ERR_CONNECT_TIMEOUT',
  'STOCK_VERSION_CONFLICT',
  'INVALID_STATE',
]);
const safeFields = new Set([
  'data',
  'id',
  'categoryId',
  'name',
  'en',
  'vi',
  'stockQty',
  'version',
  'priceVnd',
  'isAvailable',
  'permissions',
  'role',
  'email',
  'fullName',
  'hasPassword',
  'preferredLocale',
  'createdAt',
]);
const safeIssueCodes = new Set([
  'invalid_type',
  'invalid_value',
  'invalid_format',
  'invalid_union',
  'too_big',
  'too_small',
  'unrecognized_keys',
  'custom',
  'not_multiple_of',
  'invalid_key',
  'invalid_element',
]);
const safeNames = new Set([
  'Error',
  'ApiClientError',
  'ZodError',
  'TypeError',
  'SyntaxError',
  'RangeError',
  'AbortError',
  'TimeoutError',
  'AggregateError',
]);

function property(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' && key in value
    ? Reflect.get(value, key)
    : undefined;
}

export function diagnosticError(value: unknown, depth = 0): Record<string, unknown> {
  const rawName = property(value, 'name');
  const name = typeof rawName === 'string' && safeNames.has(rawName) ? rawName : 'UnknownError';
  const rawStatus = property(value, 'status');
  const status =
    typeof rawStatus === 'number' &&
    Number.isInteger(rawStatus) &&
    rawStatus >= 100 &&
    rawStatus <= 599
      ? rawStatus
      : null;
  const rawCode = property(value, 'code');
  const code = typeof rawCode === 'string' && safeCodes.has(rawCode) ? rawCode : null;
  const rawIssues = property(value, 'issues');
  const issues = Array.isArray(rawIssues)
    ? rawIssues.slice(0, 8).map((issue) => {
        const path = property(issue, 'path');
        const issueCode = property(issue, 'code');
        const expected = property(issue, 'expected');
        return {
          code:
            typeof issueCode === 'string' && safeIssueCodes.has(issueCode) ? issueCode : 'other',
          path: Array.isArray(path)
            ? path
                .slice(0, 8)
                .map((part) =>
                  typeof part === 'number'
                    ? part
                    : typeof part === 'string' && safeFields.has(part)
                      ? part
                      : '[field]',
                )
            : [],
          ...(typeof expected === 'string' &&
          [
            'string',
            'number',
            'int',
            'boolean',
            'array',
            'object',
            'null',
            'undefined',
            'nonoptional',
          ].includes(expected)
            ? { expected }
            : {}),
        };
      })
    : undefined;
  const rawMessage = property(value, 'message');
  const message =
    value instanceof ApiClientError && code && rawMessage === `${status} ${code}`
      ? rawMessage
      : issues
        ? `Response validation failed (${Array.isArray(rawIssues) ? rawIssues.length : 0} issues)`
        : typeof rawMessage === 'string' &&
            [
              'fetch failed',
              'Invalid gateway configuration',
              'Failed to parse URL',
              'The operation was aborted due to timeout',
              'The operation was aborted.',
            ].includes(rawMessage)
          ? rawMessage
          : typeof rawMessage === 'string'
            ? '[redacted message]'
            : null;
  const rawStack = property(value, 'stack');
  const frames =
    typeof rawStack === 'string'
      ? rawStack
          .split('\n')
          .slice(1)
          .flatMap((line) => {
            const location =
              line.match(
                /(?:[\\/]|^)((?:src|packages|node_modules|\.next)[\\/][^\s?#)]+:\d+:\d+)/,
              )?.[1] ?? line.match(/node:[\w./:-]+:\d+:\d+/)?.[0];
            return location ? [`at ${location}`] : [];
          })
          .slice(0, 8)
      : [];
  const nested = property(value, 'cause');
  return {
    name,
    message,
    status,
    code,
    stack:
      typeof rawStack === 'string' ? [`${name}: ${message ?? ''}`, ...frames].join('\n') : null,
    ...(issues ? { issues } : {}),
    ...(nested !== undefined && depth < 2 ? { cause: diagnosticError(nested, depth + 1) } : {}),
  };
}

const labels: Record<string, string> = {
  '/users/me': 'auth.current-user',
  '/staff/products': 'inventory.products',
  '/staff/toppings': 'inventory.toppings',
};

export function logStaffDiagnostic(
  level: 'info' | 'error',
  diagnostic: {
    endpoint?: string;
    stage: string;
    status?: number;
    errorCode?: string;
    networkCode?: string;
    bodyType?: string;
    dataType?: string;
    itemCount?: number;
    reason?: string;
  },
  error?: unknown,
) {
  console[level](
    `[staff-api] ${JSON.stringify({
      request: diagnostic.endpoint ? labels[diagnostic.endpoint] : 'configuration',
      ...diagnostic,
      ...(error !== undefined ? { error: diagnosticError(error) } : {}),
    })}`,
  );
}
