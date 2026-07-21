// Client -> server (FE chủ động gọi khi vào/rời trang chi tiết event)
export const WS_CLIENT_EVENTS = {
    JOIN_EVENT_ROOM: 'join_event_room',
    LEAVE_EVENT_ROOM: 'leave_event_room'
} as const;

// server --> client (BE chủ động đẩy xuống)
export const WS_SERVER_EVENTS = {
    TICKET_AVAILABILITY_UPDATED: 'ticket_availability_updated',
    NOTIFICATION: 'notification'
} as const;
