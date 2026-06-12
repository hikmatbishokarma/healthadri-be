import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  @Get('navigators')
  async findNavigators(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.usersService.findAllNavigators({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      hospitalId,
      sortBy,
      order,
    });
  }

  @Get('patients')
  async findPatients(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('navigatorId') navigatorId?: string,
    @Query('cancerType') cancerType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.usersService.findAllPatients({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      hospitalId,
      navigatorId,
      cancerType,
      sortBy,
      order,
    });
  }

  @Get('me')
  async me(@Headers('authorization') authHeader?: string) {
    const userId = this.userIdFromHeader(authHeader);
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  @Post('profile')
  async updateProfile(
    @Headers('authorization') authHeader: string | undefined,
    @Body() dto: UpdateProfileDto,
  ) {
    const userId = this.userIdFromHeader(authHeader);
    return this.usersService.updateProfile(userId, dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/device-token')
  async addDeviceToken(
    @Param('id') id: string,
    @Body() body: { token: string },
  ) {
    if (!body?.token) throw new BadRequestException('token is required');
    await this.usersService.addDeviceToken(id, body.token);
    return { ok: true };
  }

  @Delete(':id/device-token')
  async removeDeviceToken(
    @Param('id') id: string,
    @Body() body: { token: string },
  ) {
    if (!body?.token) throw new BadRequestException('token is required');
    await this.usersService.removeDeviceToken(id, body.token);
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  private userIdFromHeader(authHeader?: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
