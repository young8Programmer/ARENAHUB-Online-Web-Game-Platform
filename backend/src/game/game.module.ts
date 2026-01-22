import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { Match } from './entities/match.entity';
import { UsersModule } from '../users/users.module';
import { RedisModule } from './redis.module';
import { GameRoomService } from './game-room.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match]),
    UsersModule,
    RedisModule,
  ],
  providers: [GameService, GameGateway, GameRoomService],
  exports: [GameService],
})
export class GameModule {}
