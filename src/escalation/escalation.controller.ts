import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EscalationService } from './escalation.service';
import { ResolveEscalationDto } from './dto/resolve-escalation.dto';

@Controller('escalations')
export class EscalationController {
  constructor(private readonly escalationService: EscalationService) {}

  @Get('navigator/:navigatorId')
  getOpenByNavigator(@Param('navigatorId') navigatorId: string) {
    return this.escalationService.getOpenByNavigator(navigatorId);
  }

  @Get('navigator/:navigatorId/all')
  getAllByNavigator(@Param('navigatorId') navigatorId: string) {
    return this.escalationService.getAllByNavigator(navigatorId);
  }

  @Get('patient/:patientId')
  getForPatient(@Param('patientId') patientId: string) {
    return this.escalationService.getForPatient(patientId);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveEscalationDto) {
    return this.escalationService.resolve(id, dto.resolvedById, dto.note);
  }

  @Post(':id/escalate')
  escalate(@Param('id') id: string) {
    return this.escalationService.escalateToNavigator(id);
  }
}
