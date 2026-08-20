import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      issuer: config.get<string>('JWT_ISSUER', 'ticketing-sla-api'),
      audience: config.get<string>('JWT_AUDIENCE', 'ticketing-sla-web')
    });
  }

  async validate(payload: { sub: string; type: string }) {
    if (payload.type !== 'access') throw new UnauthorizedException();
    const user = await this.auth.getAuthUser(payload.sub);
    if (user.status !== 'APPROVED') throw new UnauthorizedException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Akun tidak aktif.' });
    return user;
  }
}
