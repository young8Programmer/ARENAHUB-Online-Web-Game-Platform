import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
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
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  providers: [GameService, GameGateway, GameRoomService],
  exports: [GameService],
})
export class GameModule {}
