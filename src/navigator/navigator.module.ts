import { Module } from '@nestjs/common';
import { NavigatorController } from './navigator.controller';
import { NavigatorService } from './navigator.service';
import { AlertsModule } from '../alerts/alerts.module';
import { PlaybooksModule } from '../playbooks/playbooks.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AlertsModule, PlaybooksModule, UsersModule],
  controllers: [NavigatorController],
  providers: [NavigatorService],
})
export class NavigatorModule {}
