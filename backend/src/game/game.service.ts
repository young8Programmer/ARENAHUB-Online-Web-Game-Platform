import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Match)
    private matchesRepository: Repository<Match>,
    private usersService: UsersService,
  ) {}

  async createMatch(playerIds: string[]): Promise<Match> {
    const match = this.matchesRepository.create({
      players: playerIds.map((id) => ({ id } as any)),
      startedAt: new Date(),
    });
    return this.matchesRepository.save(match);
  }

  async endMatch(
    matchId: string,
    winnerId: string,
    scores: Record<string, number>,
    duration: number,
  ): Promise<Match> {
    const match = await this.matchesRepository.findOne({
      where: { id: matchId },
      relations: ['players'],
    });

    if (!match) throw new Error('Match not found');

    match.winnerId = winnerId;
    match.scores = scores;
    match.endedAt = new Date();
    match.duration = duration;

    // Update player stats
    for (const player of match.players) {
      const won = player.id === winnerId;
      await this.usersService.updateStats(player.id, won);
    }

    return this.matchesRepository.save(match);
  }

  async getMatchHistory(userId: string, limit: number = 10): Promise<Match[]> {
    return this.matchesRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.players', 'player')
      .where('player.id = :userId', { userId })
      .orderBy('match.startedAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
