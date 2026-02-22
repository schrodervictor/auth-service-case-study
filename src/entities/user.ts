import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn('uuid')
        id!: string;

    @Column({ type: 'varchar', name: 'email', unique: true })
        email!: string;

    @Column({ type: 'varchar', name: 'password_hash' })
        passwordHash!: string;

    @Column({ type: 'varchar', name: 'first_name' })
        firstName!: string;

    @Column({ type: 'varchar', name: 'last_name' })
        lastName!: string;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
        createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
        updatedAt!: Date;
}
