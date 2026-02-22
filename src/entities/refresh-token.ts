import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user';

@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', name: 'token_hash' })
    tokenHash!: string;

    @Column({ type: 'uuid', name: 'user_id' })
    userId!: string;

    @Column({ type: 'timestamp', name: 'expires_at' })
    expiresAt!: Date;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user!: User;
}
