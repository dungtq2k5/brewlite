import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

/**
 * One helmet middleware, chosen by path — a second `helmet()` scoped to `/docs` cannot
 * loosen a header the global one already set, and helmet's default CSP blocks Swagger
 * UI's inline scripts.
 */
export function pathAwareHelmet() {
  const strict = helmet();
  const forDocs = helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
      },
    },
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const middleware = req.path.startsWith('/docs') ? forDocs : strict;
    middleware(req, res, next);
  };
}
