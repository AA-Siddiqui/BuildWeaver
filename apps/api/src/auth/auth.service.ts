import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '@buildweaver/db';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.usersService.create(dto.email, passwordHash);
    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResult(user);
  }

  private async buildAuthResult(user: User): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    const { passwordHash: _passwordHash, ...safeUser } = user;
    void _passwordHash;
    return { token, user: safeUser };
  }

  private hashPassword(password: string) {
    const rounds = Number(this.configService.get<string>('BCRYPT_ROUNDS') ?? '12');
    return bcrypt.hash(password, rounds);
  }
}
