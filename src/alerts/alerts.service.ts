import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument } from './alert.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    private eventsGateway: EventsGateway,
  ) {}

  async create(data: Partial<Alert>) {
    const alert = await this.alertModel.create(data);
    if (data.navigatorId) {
      this.eventsGateway.emitNewAlert(data.navigatorId.toString(), {
        _id: alert._id,
        patientId: alert.patientId,
        severity: alert.severity,
        type: alert.type,
        reason: alert.reason,
      });
    }
    return alert;
  }

  async findPendingByNavigator(navigatorId: string) {
    return this.alertModel
      .find({
        navigatorId: new Types.ObjectId(navigatorId),
        status: 'pending',
      })
      .populate('patientId')
      .sort({ severity: 1 });
  }

  async findLatestByPatient(patientId: string) {
    return this.alertModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 })
      .limit(10);
  }

  async findOneLatestByPatient(patientId: string) {
    return this.alertModel
      .findOne({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 });
  }

  async countByNavigatorSince(
    navigatorId: string,
    since: Date,
    before?: Date,
    severity?: string,
  ) {
    const query: Record<string, unknown> = {
      navigatorId: new Types.ObjectId(navigatorId),
      createdAt: before
        ? { $gte: since, $lt: before }
        : { $gte: since },
    };
    if (severity) query.severity = severity;
    return this.alertModel.countDocuments(query);
  }

  async findPendingByPatients(patientIds: string[]) {
    return this.alertModel
      .find({
        patientId: { $in: patientIds.map((id) => new Types.ObjectId(id)) },
        status: 'pending',
      })
      .sort({ severity: 1, createdAt: -1 });
  }

  async resolve(alertId: string) {
    return this.alertModel.findByIdAndUpdate(
      alertId,
      { status: 'resolved' },
      { new: true },
    );
  }
}
