import { IsDate, IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateEventDto {
    @IsString()
    @IsNotEmpty()
    title: string

    @IsString()
    @IsOptional()
    description?: string

    @IsString()
    @IsOptional()
    bannerUrl: string

    @IsString()
    @IsNotEmpty()
    location: string

    @IsString()
    @IsOptional()
    category?: string

    @IsDateString()
    @IsNotEmpty()
    startTime: string

    @IsDateString()
    @IsNotEmpty()
    endTime: string
}
