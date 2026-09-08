import { AuthService } from './auth';

describe('AuthService login protection', () => {
  it('blocks the sixth failed password attempt for the same IP and username', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    const service = new AuthService(prisma);
    const response = { cookie: jest.fn() } as never;
    for (let attempt = 0; attempt < 5; attempt++) await service.login({ username: 'user', password: 'long-enough-password' }, response, '127.0.0.1').catch((error) => expect(error.getResponse().error.code).toBe('INVALID_CREDENTIALS'));
    await service.login({ username: 'user', password: 'long-enough-password' }, response, '127.0.0.1').catch((error) => { expect(error.getStatus()).toBe(429); expect(error.getResponse().error.code).toBe('LOGIN_RATE_LIMITED'); });
  });
});
