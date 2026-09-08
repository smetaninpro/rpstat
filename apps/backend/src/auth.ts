import { Body, CanActivate, Controller, createParamDecorator, ExecutionContext, ForbiddenException, Get, HttpException, HttpStatus, Injectable, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { IsString, Length } from 'class-validator';
import { Request, Response } from 'express';
import { PrismaService } from './prisma.service';

type RequestUser = { id: string; role: Role; employeeId: string | null };
declare module 'express-serve-static-core' { interface Request { user?: RequestUser; } }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>().user);
export const Roles = (...roles: Role[]) => (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => Reflect.defineMetadata('roles', roles, descriptor?.value ?? target);
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>(); const token = req.cookies?.rmrp_session;
    if (!token) throw new UnauthorizedException();
    const session = await this.prisma.session.findFirst({ where: { tokenHash: hash(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session || session.user.disabledAt) throw new UnauthorizedException();
    req.user = { id: session.user.id, role: session.user.role, employeeId: session.user.employeeId };
    return true;
  }
}
@Injectable()
export class RoleGuard implements CanActivate { canActivate(context: ExecutionContext) { const roles: Role[] = Reflect.getMetadata('roles', context.getHandler()) ?? []; const user = context.switchToHttp().getRequest<Request>().user; if (roles.length && (!user || !roles.includes(user.role))) throw new ForbiddenException(); return true; } }
class LoginDto { @IsString() @Length(3, 128) username!: string; @IsString() @Length(12, 128) password!: string; }
@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly prisma: PrismaService) {}
  async login(dto: LoginDto, response: Response, ip: string) {
    const key = `${ip}:${dto.username.toLowerCase()}`; const attempt = this.attempts.get(key);
    if (attempt && attempt.resetAt > Date.now() && attempt.count >= 5) throw new HttpException({ error: { code: 'LOGIN_RATE_LIMITED', message: 'Повторите попытку позже' } }, HttpStatus.TOO_MANY_REQUESTS);
    const user = await this.prisma.user.findFirst({ where: { OR: [{ username: dto.username }, { email: dto.username }] } });
    if (!user || user.disabledAt || !(await argon2.verify(user.passwordHash, dto.password))) { const current = attempt && attempt.resetAt > Date.now() ? attempt : { count: 0, resetAt: Date.now() + 15 * 60000 }; this.attempts.set(key, { ...current, count: current.count + 1 }); throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Неверные учетные данные' } }); }
    this.attempts.delete(key);
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    response.cookie('rmrp_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    response.cookie('rmrp_csrf', randomBytes(24).toString('base64url'), { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    return { user: { id: user.id, username: user.username, role: user.role, employeeId: user.employeeId } };
  }
}
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService) {}
  @Post('login') login(@Body() dto: LoginDto, @Req() req: Request) { return this.auth.login(dto, req.res!, req.ip ?? 'unknown'); }
  @Get('me') @UseGuards(SessionGuard) me(@CurrentUser() user: RequestUser) { return { user }; }
  @Post('logout') @UseGuards(SessionGuard) async logout(@Req() req: Request) { await this.prisma.session.updateMany({ where: { tokenHash: hash(req.cookies.rmrp_session), revokedAt: null }, data: { revokedAt: new Date() } }); req.res!.clearCookie('rmrp_session'); return { ok: true }; }
}
