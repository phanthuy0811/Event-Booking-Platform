import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorPaginationDto {
    @IsOptional()
    @IsUUID()
    cursor?: string; // ID của item cuối cùng trong trang trước

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 20;
}
