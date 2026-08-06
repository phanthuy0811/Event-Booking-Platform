import { IsNotEmpty, IsPositive, IsString, MinLength, IsNumber, IsOptional, IsDateString, IsInt, Min } from "class-validator";

export class CreateTicketTypeDto {
    @IsString()
    @MinLength(3)
    name: string

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    price: number

    @IsInt()
    @Min(1)
    totalQuantity: number

    @IsOptional()
    @IsDateString()
    salesStart?: string

    @IsOptional()
    @IsDateString()
    salesEnd?: string

}
