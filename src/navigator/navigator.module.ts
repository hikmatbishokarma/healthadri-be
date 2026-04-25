import { Module } from '@nestjs/common';
import { NavigatorController } from './navigator.controller';
import { NavigatorService } from './navigator.service';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AlertsModule],
  controllers: [NavigatorController],
  providers: [NavigatorService],
})
export class NavigatorModule {}
