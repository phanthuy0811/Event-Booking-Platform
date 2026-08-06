import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Auth System (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /auth/register - Đăng ký tài khoản thành công', async () => {
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: `e2e-${Date.now()}@example.com`,
                password: 'Password123!',
                fullName: 'E2E User',
            })
            .expect(201);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
    });

    it('POST /auth/login - Đăng nhập thất bại khi sai mật khẩu', async () => {
        await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'nonexistent@example.com',
                password: 'WrongPassword',
            })
            .expect(401);
    });
});
