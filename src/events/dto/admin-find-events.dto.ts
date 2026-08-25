import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { EventStatus } from "@prisma/client";

export class AdminFindEventsDto {
    @IsOptional()
    @IsEnum(EventStatus)
    status?: EventStatus;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}
