import { IsDateString, IsOptional, IsString } from "class-validator";

export class findEventsQueryDto {
    @IsString()
    @IsOptional()
    location?: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsString()
    @IsOptional()
    search?: string;
}