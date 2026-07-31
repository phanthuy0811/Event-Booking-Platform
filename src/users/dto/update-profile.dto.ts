import { Optional } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
    @Optional()
    @IsString()
    @MinLength(2)
    fullName?: string;
}