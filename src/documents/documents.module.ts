import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentMeta, DocumentMetaSchema } from './document.schema';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentProcessingModule } from '../document-processing/document-processing.module';
import { AlertsModule } from '../alerts/alerts.module';
import { UsersModule } from '../users/users.module';
import { ReviewQueueModule } from '../review-queue/review-queue.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentMeta.name, schema: DocumentMetaSchema },
    ]),
    DocumentProcessingModule,
    AlertsModule,
    UsersModule,
    ReviewQueueModule,
    EventsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
