import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.path.startsWith('/api/internal/') && req.path !== '/api/auth/login') {
      const origin = req.get('origin');
      if (origin !== process.env.FRONTEND_ORIGIN || !req.cookies?.rmrp_csrf || req.get('x-csrf-token') !== req.cookies.rmrp_csrf) return res.status(403).json({ error: { code: 'CSRF_REJECTED', message: 'Недействительный запрос' } });
    }
    next();
  });
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(3001, '0.0.0.0');
}
bootstrap();
