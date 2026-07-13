import { SetMetadata } from "@nestjs/common";


//Dùng để gắn thẻ quyền hạn (Metadata) cho API. 
// Ví dụ: @Roles('ADMIN', 'ORGANIZER')
// Thông tin này sau đó sẽ được file roles.guard.ts đọc để kiểm tra quyền.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
