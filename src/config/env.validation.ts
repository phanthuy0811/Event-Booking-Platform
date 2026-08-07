import * as Joi from 'joi';

// để báo lỗi nếu thiếu jwt-secret hay database url ngay khi khởi động
export const envValidationSchema = Joi.object({
    DATABASE_URL: Joi.string().required(),

    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),

    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default('15m'),
    JWT_REFRESH_SECRET: Joi.string().required(),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

    PORT: Joi.number().default(3000),
    FRONTEND_URL: Joi.string().default('http://localhost:5000'),

    RESERVATION_HOLD_MINUTES: Joi.number().default(10),
    MOCK_PAYMENT_WEBHOOK_DELAY_MS: Joi.number().default(5000),
});
