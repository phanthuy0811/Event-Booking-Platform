import { IsUUID, IsOptional, IsIn } from "class-validator";
import { REMINDER_PRESETS_MINUTES } from "src/notifications/notifications.constants";

export class CreateOrderDto {
    @IsUUID()
    reservationId: string

    @IsOptional()
    @IsIn(REMINDER_PRESETS_MINUTES)
    reminderMinutesBefore?: number;
}
