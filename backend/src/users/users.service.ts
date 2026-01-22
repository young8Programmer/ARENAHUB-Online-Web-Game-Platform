import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOne(username: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(username: string, hashedPassword: string): Promise<User> {
    const user = this.usersRepository.create({
      username,
      password: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  async updateStats(userId: string, won: boolean): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    if (won) {
      user.wins += 1;
      user.rating += 20;
    } else {
      user.losses += 1;
      user.rating = Math.max(0, user.rating - 15);
    }

    return this.usersRepository.save(user);
  }

  async getLeaderboard(limit: number = 10): Promise<User[]> {
    return this.usersRepository.find({
      order: { rating: 'DESC' },
      take: limit,
      select: ['id', 'username', 'rating', 'wins', 'losses'],
    });
  }
}
