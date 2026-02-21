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

    @Column({ unique: true })
        email!: string;

    @Column({ name: 'password_hash' })
        passwordHash!: string;

    @Column({ name: 'first_name' })
        firstName!: string;

    @Column({ name: 'last_name' })
        lastName!: string;

    @CreateDateColumn({ name: 'created_at' })
        createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
        updatedAt!: Date;
}
