import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Symptom, SymptomSchema } from './symptom.schema';
import { SymptomsService } from './symptoms.service';
import { SymptomsController } from './symptoms.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Symptom.name, schema: SymptomSchema }])],
  controllers: [SymptomsController],
  providers: [SymptomsService],
  exports: [SymptomsService],
})
export class SymptomsModule {}
