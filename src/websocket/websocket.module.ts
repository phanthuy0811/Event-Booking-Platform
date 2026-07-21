import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AppGateway } from './websocket.gateway';

@Module({
  imports: [AuthModule],
  providers: [AppGateway],
  exports: [AppGateway]
})
export class WebsocketModule { }
