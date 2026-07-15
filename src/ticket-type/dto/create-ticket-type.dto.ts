import { IsNotEmpty, IsPositive, IsString, MinLength, IsNumber, IsOptional, IsDateString } from "class-validator";

export class CreateTicketTypeDto {
    @IsString()
    @MinLength(3)
    name: string

    @IsPositive()
    price: number

    @IsNumber()
    totalQuantity: number

    @IsOptional()
    @IsDateString()
    salesStart?: string

    @IsOptional()
    @IsDateString()
    salesEnd?: string

}
