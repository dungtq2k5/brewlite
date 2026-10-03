import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL_MS, JWT_AUDIENCE, JWT_ISSUER } from '@brewlite/contracts';
import type { Env } from '../../config/env.schema.js';

export interface SignedAccessToken {
  accessToken: string;
  accessTokenExpiresAt: string;
}

/** ES256 access tokens, header `kid: JWT_KEY_ID`, claims `sub`, `role`, `sid` (architecture §5). */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  signAccessToken(userId: string, role: string, sessionId: string): SignedAccessToken {
    const privateKey = Buffer.from(
      this.config.get('JWT_PRIVATE_KEY', { infer: true }),
      'base64',
    ).toString('utf8');
    const accessToken = this.jwt.sign(
      { sub: userId, role, sid: sessionId },
      {
        algorithm: 'ES256',
        privateKey,
        keyid: this.config.get('JWT_KEY_ID', { infer: true }),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      },
    );
    return {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString(),
    };
  }
}
