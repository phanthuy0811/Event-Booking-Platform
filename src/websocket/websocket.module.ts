import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AppGateway } from './websocket.gateway';
import { WsJwtGuard } from 'src/auth/guards/ws-jwt.guard';

@Module({
  imports: [AuthModule],
  providers: [AppGateway, WsJwtGuard],
  exports: [AppGateway]
})
export class WebsocketModule { }
