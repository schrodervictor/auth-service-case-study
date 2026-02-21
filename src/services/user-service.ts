export type RegisterUserDto = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
};

export type UpdateProfileDto = {
    firstName?: string;
    lastName?: string;
};

export type UserResponseDto = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
};

export type AuthResponseDto = {
    token: string;
};

export interface UserService {
    register(data: RegisterUserDto): Promise<UserResponseDto>;
    authenticate(email: string, password: string): Promise<AuthResponseDto>;
    getProfile(userId: string): Promise<UserResponseDto>;
    updateProfile(
        userId: string,
        data: UpdateProfileDto,
    ): Promise<UserResponseDto>;
}
