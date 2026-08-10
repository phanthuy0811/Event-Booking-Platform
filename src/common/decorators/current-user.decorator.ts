import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUserPayload {
    userId: string;
    email: string;
    role: string;
    refreshToken?: string;
    jti?: string;
    requestId?: string;
}

// Trích xuất thông tin người dùng từ request.user (đã được JWT Guard giải mã)
// và đưa trực tiếp vào tham số của Controller
// Ví dụ: @CurrentUser() currentUser: CurrentUserPayload.
export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): CurrentUserPayload => {
        const request = context.switchToHttp().getRequest();
        return {
            ...request.user,
            requestId: request['id']
        };
    })