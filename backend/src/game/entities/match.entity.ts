import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToMany(() => User)
  @JoinTable()
  players: User[];

  @Column({ nullable: true })
  winnerId: string;

  @Column('jsonb', { nullable: true })
  scores: Record<string, number>;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  endedAt: Date;

  @Column({ default: 0 })
  duration: number; // in seconds
}
