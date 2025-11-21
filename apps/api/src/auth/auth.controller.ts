import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ok } from '../common/api-response';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from './interfaces/auth-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Registers a new user account' })
  async signup(@Body() dto: SignupDto) {
    const result = await this.authService.signup(dto);
    return ok(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: HttpStatus.OK, description: 'Logs in and returns an access token' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return ok(result);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the authenticated user profile' })
  async me(@CurrentUser() user: AuthUser) {
    return ok({
      user: {
        id: user.sub,
        email: user.email
      }
    });
  }
}
