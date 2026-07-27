import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global ValidationPipe: mọi DTO có class-validator decorator sẽ tự validate
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, //loại bỏ field lạ không khai báo trong DTO
    forbidNonWhitelisted: true, // báo lỗi khi có filed lạ , nếu chỉ dùng whitelist thì vẫn thành công nếu thừa field, còn dùng thêm forbidNonWhitelisted thì sẽ báo lỗi
    transform: true, // tự động chuyển đổi kiểu dữ liệu
  }))

  // Thứ tự QUAN TRỌNG: filter cụ thể (Prisma) đứng trước, filter bắt-tất-cả đứng sau
  app.useGlobalFilters(new PrismaExceptionFilter(), new AllExceptionsFilter())

  // TransformResponseInterceptor bọc trong cùng để chuẩn hóa response
  app.useGlobalInterceptors(new TransformResponseInterceptor())

  app.enableCors({
    origin: 'http://localhost:5000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
