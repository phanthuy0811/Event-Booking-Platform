import { Role } from "@prisma/client";
import { IsEnum, IsNotEmpty } from "class-validator";

export class UpdateUserRoleDto {
    @IsEnum(Role)
    @IsNotEmpty()
    role: Role
}