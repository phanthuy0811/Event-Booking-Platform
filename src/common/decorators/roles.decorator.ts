import { SetMetadata } from "@nestjs/common";


//Tạo 1 hằng số ROLES_KEY gán là roles
export const ROLES_KEY = 'roles';
// Tạo ra 1 decorator tên là @Roles().  Dấu ...roles nghĩa là nó nhận vào vô số chữ (ví dụ: 'ADMIN', 'ORGANIZER').
// Hàm SetMetadata của NestJS sẽ lấy cái mảng chữ đó dán ẩn vào API đang được gọi.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
