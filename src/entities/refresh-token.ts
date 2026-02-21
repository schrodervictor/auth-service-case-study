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

    @Column({ name: 'token_hash' })
        tokenHash!: string;

    @Column({ name: 'user_id' })
        userId!: string;

    @Column({ name: 'expires_at' })
        expiresAt!: Date;

    @CreateDateColumn({ name: 'created_at' })
        createdAt!: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
        user!: User;
}
