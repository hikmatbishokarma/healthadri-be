import 'dotenv/config';
import * as mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';

async function seed() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  await db.dropDatabase();
  console.log('Database cleared.');

  // 1. Hospitals (need IDs before patient)
  const hospitals = await db.collection('hospitals').insertMany([
    { name: 'City Cancer Center', city: 'New York', tags: ['oncology', 'surgery'] },
    { name: 'Memorial Hospital', city: 'Boston', tags: ['oncology', 'radiation'] },
    { name: 'Health First Clinic', city: 'Chicago', tags: ['general', 'oncology'] },
  ]);
  const cityCancerCenterId = hospitals.insertedIds[0];
  console.log('Hospitals created.');

  // 2. Navigator
  const navigatorResult = await db.collection('users').insertOne({
    name: 'Nurse Sarah',
    phone: '1111111111',
    role: 'navigator',
    assignedNavigatorId: null,
    cancerType: '',
    cancerStage: '',
    avatar: '',
    profileCompleted: true,
    gender: '',
    hospitalName: '',
    hospitalId: null,
    languages: [],
    chemoSessionsCompleted: 0,
    chemoSessionsTotal: 0,
    acuityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const navigatorId = navigatorResult.insertedId;
  console.log('Navigator created:', navigatorId);

  // 3. Patient
  const patientCode = `HA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const patientResult = await db.collection('users').insertOne({
    name: 'John Doe',
    phone: '2222222222',
    role: 'patient',
    assignedNavigatorId: navigatorId,
    cancerType: 'Lung',
    cancerStage: 'Stage II',
    avatar: '',
    profileCompleted: true,
    age: 52,
    gender: 'male',
    hospitalName: 'City Cancer Center',
    hospitalId: cityCancerCenterId,
    patientCode,
    languages: ['Telugu', 'English'],
    chemoSessionsCompleted: 3,
    chemoSessionsTotal: 6,
    acuityScore: 6.2,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const patientId = patientResult.insertedId;
  console.log('Patient created:', patientId, `(${patientCode})`);

  // 4. Symptoms
  const symptomsResult = await db.collection('symptoms').insertMany([
    { name: 'Pain Level', type: 'scale', min: 0, max: 10, threshold: 6 },
    { name: 'Fatigue', type: 'scale', min: 0, max: 10, threshold: 7 },
    { name: 'Nausea', type: 'scale', min: 0, max: 10, threshold: 6 },
    { name: 'Appetite', type: 'scale', min: 0, max: 10, threshold: 4 },
    { name: 'Fever', type: 'scale', min: 0, max: 10, threshold: 5 },
  ]);
  const painResult = { insertedId: symptomsResult.insertedIds[0] };
  const fatigueResult = { insertedId: symptomsResult.insertedIds[1] };
  console.log('Symptoms created: Pain, Fatigue, Nausea, Appetite, Fever');

  // 5. Playbooks
  await db.collection('playbooks').insertMany([
    {
      triggerType: 'HIGH_FATIGUE',
      title: 'High Fatigue Protocol',
      steps: [
        'Call patient within 1 hour',
        'Assess sleep and nutrition',
        'Check medication side effects',
        'Schedule follow-up in 24 hours',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      triggerType: 'HIGH_PAIN',
      title: 'High Pain Protocol',
      steps: [
        'Call patient immediately',
        'Assess pain location and intensity',
        'Review current pain management',
        'Escalate to oncologist if needed',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log('Playbooks created.');

  console.log('\n--- Seed Complete ---');
  console.log(`Navigator ID: ${navigatorId}`);
  console.log(`Patient ID:   ${patientId}`);
  console.log(`Patient Code: ${patientCode}`);
  console.log(`Fatigue Symptom ID: ${fatigueResult.insertedId}`);
  console.log(`Pain Symptom ID:    ${painResult.insertedId}`);
  console.log(`City Cancer Center ID: ${cityCancerCenterId}`);
  console.log('\nUse these IDs in your API calls.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
