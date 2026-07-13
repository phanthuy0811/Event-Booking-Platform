import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    success: true;
    data: T;
}

// Chạy sau khi controller xử lý xong và trả về data cho client
// Giúp mọi response thành công có cùng "hình dạng", giúp frontend dễ xử lý:
// { "success": true, "data": { ... } }
// Lỗi thì đã có Exception Filter xử lý riêng, không đi qua đây.
@Injectable()
export class TransformResponseInterceptor<T>
    implements NestInterceptor<T, Response<T>> {
    intercept(
        _context: ExecutionContext,
        next: CallHandler,
    ): Observable<Response<T>> {
        return next.handle().pipe(map((data) => ({ success: true, data })));
    }
}