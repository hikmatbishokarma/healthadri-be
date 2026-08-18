import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
