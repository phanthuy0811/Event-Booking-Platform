import { IsInt, IsPositive, IsUUID } from "class-validator";

export class CreateReservationDto {
    @IsUUID()
    ticketTypeId: string

    @IsInt()
    @IsPositive()
    quantity: number
}
