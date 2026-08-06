import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { WS_CLIENT_EVENTS, WS_SERVER_EVENTS } from "./websocket.events";

@WebSocketGateway({
    cors: {
        origin: "*",
    }
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(AppGateway.name);
    constructor(private readonly jwtService: JwtService) { }

    // Chạy mỗi khi có 1 client (browser tab) kết nối socket
    async handleConnection(client: Socket) {
        const token = this.extractToken(client);

        // Không có token vẫn cho kết nối bình thường - họ chỉ không nhận được
        // notification cá nhân, nhưng vẫn join room công khai (xem vé real-time) được  
        if (!token) {
            this.logger.log(`Client ${client.id} kết nối dạng khách (không JWT)`);
            return;
        }
        try {
            const payload = this.jwtService.verify(token);
            client.data.userId = payload.sub;
            // Tự động join room riêng của user -> nhận được notification cá nhân
            await client.join(this.userRoom(payload.sub));
            this.logger.log(`Client ${client.id} xác thực là user ${payload.sub}`);
        } catch (err) {
            this.logger.warn(`Client ${client.id} gửi JWT không hợp lệ: ${err.message}`);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client ${client.id} ngắt kết nối`);
    }

    // FE gọi khi vào trang chi tiết 1 event - không cần login, vì số lượng vé còn lại là public
    @SubscribeMessage(WS_CLIENT_EVENTS.JOIN_EVENT_ROOM)
    handleJoinEventRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { eventId: string }
    ) {
        client.join(this.eventRoom(data.eventId));
    }

    // FE gọi khi rời trang chi tiết event - tránh giữ socket trong room mãi
    @SubscribeMessage(WS_CLIENT_EVENTS.LEAVE_EVENT_ROOM)
    handleLeaveEventRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { eventId: string },
    ) {
        client.leave(this.eventRoom(data.eventId));
    }

    // Được gọi bỏi ReservationService mỗi khi remainingQuantity đổi
    broadcastTicketAvailability(eventId: string, payload: unknown) {
        if (!this.server) return;
        this.server
            .to(this.eventRoom(eventId))
            .emit(WS_SERVER_EVENTS.TICKET_AVAILABILITY_UPDATED, payload);
    }

    // Được gọi bởi notification service 
    // Trả về true/false để NotificationsService biết user CÓ đang mở app hay không để gửi thông báo lên màn hình
    pushNotificationToUser(userId: string, payload: unknown): boolean {
        if (!this.server) return false;
        const room = this.server.sockets.adapter.rooms.get(this.userRoom(userId));
        const isOnline = !!room && room.size > 0;
        if (isOnline) {
            this.server.to(this.userRoom(userId)).emit(WS_SERVER_EVENTS.NOTIFICATION, payload);
        }
        return isOnline;
    }


    private eventRoom(eventId: string) {
        return `event:${eventId}`;
    }

    private userRoom(userId: string) {
        return `user:${userId}`;
    }

    private extractToken(client: Socket): string | null {
        const fromAuth = client.handshake.auth?.token as string | undefined;
        const fromQuery = client.handshake.query?.token as string | undefined;
        return fromAuth ?? fromQuery ?? null;
    }
}