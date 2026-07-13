import { Injectable } from "@nestjs/common";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "@prisma/client";

@Injectable()
export class CreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    passwordHash: string;

    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsEnum(Role)
    @IsOptional()
    role: Role;
}
