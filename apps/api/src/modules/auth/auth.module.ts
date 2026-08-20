import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          issuer: config.get<string>('JWT_ISSUER', 'ticketing-sla-api'),
          audience: config.get<string>('JWT_AUDIENCE', 'ticketing-sla-web')
        }
      })
    })
  ],
  controllers: [AuthController], providers: [AuthService, JwtStrategy], exports: [AuthService]
})
export class AuthModule {}
