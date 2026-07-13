// bat buoc dang nhap
// kiểm tra xem có truyển token không, nếu không báo lỗi 401 

import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }