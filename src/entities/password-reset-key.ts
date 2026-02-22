import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user';

@Entity({ name: 'password_reset_keys' })
export class PasswordResetKey {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', name: 'key_hash' })
    keyHash!: string;

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
