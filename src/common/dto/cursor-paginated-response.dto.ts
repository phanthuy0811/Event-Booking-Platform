export class CursorPaginatedResponse<T> {
    items: T[];
    nextCursor: string | null;

    constructor(items: T[], getIdFn: (item: T) => string, limit: number) {
        const hasNextPage = items.length === limit;
        this.items = hasNextPage ? items.slice(0, -1) : items;
        this.nextCursor = hasNextPage ? getIdFn(items[items.length - 2]) : null;
    }
}


export function buildCursorResponse<T extends { id: string }>(
    items: T[],
    limit: number,
): { items: T[]; nextCursor: string | null } {
    const hasMore = items.length > limit;
    const result = hasMore ? items.slice(0, limit) : items;
    return {
        items: result,
        nextCursor: hasMore ? result[result.length - 1].id : null,
    };
}
