import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@healthadri.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'changeme123';

async function seed() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  await db.dropDatabase();
  console.log('Database cleared.');

  // 1. Hospitals
  const hospitals = await db.collection('hospitals').insertMany([
    { name: 'City Cancer Center', city: 'Hyderabad', tags: ['oncology', 'surgery'] },
    { name: 'Memorial Hospital', city: 'Bengaluru', tags: ['oncology', 'radiation'] },
    { name: 'Health First Clinic', city: 'Chennai', tags: ['general', 'oncology'] },
  ]);
  const cityCancerCenterId = hospitals.insertedIds[0];
  console.log('Hospitals created.');

  // 1b. Super-admin (web dashboard login)
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await db.collection('users').insertOne({
    name: 'Super Admin',
    phone: '',
    role: 'super-admin',
    email: SUPER_ADMIN_EMAIL.toLowerCase().trim(),
    passwordHash,
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
  console.log(`Super-admin created: ${SUPER_ADMIN_EMAIL}`);

  // 2. Navigator (Priya Sharma)
  const navigatorResult = await db.collection('users').insertOne({
    name: 'Priya Sharma',
    phone: '1111111111',
    role: 'navigator',
    assignedNavigatorId: null,
    cancerType: '',
    cancerStage: '',
    avatar: '',
    profileCompleted: true,
    gender: '',
    hospitalName: 'City Cancer Center',
    hospitalId: cityCancerCenterId,
    languages: ['English', 'Hindi', 'Telugu'],
    chemoSessionsCompleted: 0,
    chemoSessionsTotal: 0,
    acuityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const navigatorId = navigatorResult.insertedId;
  console.log('Navigator created:', navigatorId);

  // 3. Symptoms (need IDs to record entries)
  const symptomsResult = await db.collection('symptoms').insertMany([
    { name: 'Pain Level', type: 'scale', min: 0, max: 10, threshold: 6 },
    { name: 'Fatigue', type: 'scale', min: 0, max: 10, threshold: 7 },
    { name: 'Nausea', type: 'scale', min: 0, max: 10, threshold: 6 },
    { name: 'Appetite', type: 'scale', min: 0, max: 10, threshold: 4 },
    { name: 'Fever', type: 'scale', min: 0, max: 10, threshold: 5 },
  ]);
  const painId = symptomsResult.insertedIds[0];
  const fatigueId = symptomsResult.insertedIds[1];
  const feverId = symptomsResult.insertedIds[4];
  console.log('Symptoms created.');

  // 4. Patients matching the mockup
  const year = new Date().getFullYear();
  const code = (n: number) => `HA-${year}-${100000 + n}`;

  const patientsBulk = [
    {
      name: 'Ravi Kumar',
      phone: '2222222222',
      gender: 'male',
      cancerType: 'Oral Cancer',
      cancerStage: 'Stage II',
      chemoSessionsCompleted: 12,
      chemoSessionsTotal: 18,
      acuityScore: 7.4,
      languages: ['Telugu', 'English'],
    },
    {
      name: 'Sunita Devi',
      phone: '3333333333',
      gender: 'female',
      cancerType: 'Breast Cancer',
      cancerStage: 'Stage III',
      chemoSessionsCompleted: 4,
      chemoSessionsTotal: 8,
      acuityScore: 8.1,
      languages: ['Hindi', 'English'],
    },
    {
      name: 'Ramaiah G.',
      phone: '4444444444',
      gender: 'male',
      cancerType: 'Colorectal',
      cancerStage: 'Stage II',
      chemoSessionsCompleted: 2,
      chemoSessionsTotal: 6,
      acuityScore: 5.5,
      languages: ['Telugu'],
    },
    {
      name: 'Padma Reddy',
      phone: '5555555555',
      gender: 'female',
      cancerType: 'Cervical Cancer',
      cancerStage: 'Stage I',
      chemoSessionsCompleted: 1,
      chemoSessionsTotal: 4,
      acuityScore: 3.2,
      languages: ['Telugu', 'English'],
    },
  ];

  const patientIds: Record<string, mongoose.Types.ObjectId> = {};
  for (let i = 0; i < patientsBulk.length; i++) {
    const p = patientsBulk[i];
    const result = await db.collection('users').insertOne({
      name: p.name,
      phone: p.phone,
      role: 'patient',
      assignedNavigatorId: navigatorId,
      cancerType: p.cancerType,
      cancerStage: p.cancerStage,
      avatar: '',
      profileCompleted: true,
      age: 45 + i * 3,
      gender: p.gender,
      hospitalName: 'City Cancer Center',
      hospitalId: cityCancerCenterId,
      patientCode: code(i + 1),
      languages: p.languages,
      chemoSessionsCompleted: p.chemoSessionsCompleted,
      chemoSessionsTotal: p.chemoSessionsTotal,
      acuityScore: p.acuityScore,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    patientIds[p.name] = result.insertedId;
  }
  console.log('Patients created.');

  // 4b. Caregiver — Lakshmi Kumar (wife of Ravi Kumar)
  await db.collection('users').insertOne({
    name: 'Lakshmi Kumar',
    phone: '6666666666',
    role: 'caregiver',
    linkedPatientId: patientIds['Ravi Kumar'],
    assignedNavigatorId: null,
    cancerType: '',
    cancerStage: '',
    avatar: '',
    profileCompleted: false,
    age: 42,
    gender: 'female',
    hospitalName: '',
    hospitalId: null,
    patientCode: null,
    languages: ['Telugu', 'English'],
    chemoSessionsCompleted: 0,
    chemoSessionsTotal: 0,
    acuityScore: 0,
    caregiverRelationship: 'Spouse',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('Caregiver created: Lakshmi Kumar (linked to Ravi Kumar)');

  // 5. Symptom entries + Alerts (so navigator dashboard renders mockup state)
  const now = new Date();
  const at = (h: number, m = 0) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // Ravi Kumar — Fatigue 7 (HIGH)
  await db.collection('symptomentries').insertOne({
    patientId: patientIds['Ravi Kumar'],
    responses: [{ symptomId: fatigueId, name: 'Fatigue', value: 7 }],
    createdAt: at(8, 42),
    updatedAt: at(8, 42),
  });
  await db.collection('alerts').insertOne({
    patientId: patientIds['Ravi Kumar'],
    navigatorId,
    type: 'HIGH_FATIGUE',
    severity: 'HIGH',
    reason: 'Fatigue 7/10',
    status: 'pending',
    createdAt: at(8, 42),
    updatedAt: at(8, 42),
  });

  // Sunita Devi — Fever 8 (HIGH)
  await db.collection('symptomentries').insertOne({
    patientId: patientIds['Sunita Devi'],
    responses: [{ symptomId: feverId, name: 'Fever', value: 8 }],
    createdAt: at(7, 30),
    updatedAt: at(7, 30),
  });
  await db.collection('alerts').insertOne({
    patientId: patientIds['Sunita Devi'],
    navigatorId,
    type: 'HIGH_FEVER',
    severity: 'HIGH',
    reason: 'Fever 38.5°C',
    status: 'pending',
    createdAt: at(7, 30),
    updatedAt: at(7, 30),
  });

  // Ramaiah G. — Missed appointment (MED)
  await db.collection('alerts').insertOne({
    patientId: patientIds['Ramaiah G.'],
    navigatorId,
    type: 'MISSED_APPOINTMENT',
    severity: 'MED',
    reason: 'Missed appointment',
    status: 'pending',
    createdAt: at(9, 0),
    updatedAt: at(9, 0),
  });

  // Padma Reddy — Pain 6 (LOW for navigator priority — stable)
  await db.collection('symptomentries').insertOne({
    patientId: patientIds['Padma Reddy'],
    responses: [{ symptomId: painId, name: 'Pain Level', value: 6 }],
    createdAt: at(6, 15),
    updatedAt: at(6, 15),
  });
  await db.collection('alerts').insertOne({
    patientId: patientIds['Padma Reddy'],
    navigatorId,
    type: 'HIGH_PAIN_LEVEL',
    severity: 'LOW',
    reason: 'Pain 6/10',
    status: 'pending',
    createdAt: at(6, 15),
    updatedAt: at(6, 15),
  });

  console.log('Symptom entries + alerts created.');

  // 6. Playbooks (steps authored by navigator; first N auto-handled by system)
  await db.collection('playbooks').insertMany([
    {
      triggerType: 'HIGH_FATIGUE',
      title: 'High Fatigue Protocol',
      autoCompletedCount: 3,
      steps: [
        'AI detected fatigue score ≥7 in symptom check-in',
        'Notify Navigator Priya Sharma — alert sent',
        'AI tips sent to patient via app chat',
        'Navigator to call patient within 2 hours — confirm fatigue cause (chemo-related vs other)',
        'If fever >38°C or pain >8/10 — escalate to Dr. Anand Rao immediately',
        'Document outcome and update acuity score',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      triggerType: 'HIGH_FEVER',
      title: 'Fever Protocol',
      autoCompletedCount: 2,
      steps: [
        'AI detected fever ≥38°C in symptom check-in',
        'Notify Navigator Priya Sharma — alert sent',
        'Navigator to call patient within 1 hour — confirm temperature reading',
        'If fever persists >38.5°C — escalate to Dr. Anand Rao immediately',
        'Coordinate same-day clinic visit if needed',
        'Document outcome and update acuity score',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      triggerType: 'MISSED_APPOINTMENT',
      title: 'Missed Appointment Protocol',
      autoCompletedCount: 1,
      steps: [
        'System detected missed scheduled appointment',
        'Navigator to contact patient within 4 hours',
        'Reschedule appointment within the same week',
        'Document reason and update care plan',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      triggerType: 'HIGH_PAIN_LEVEL',
      title: 'High Pain Protocol',
      autoCompletedCount: 2,
      steps: [
        'AI detected pain score ≥6 in symptom check-in',
        'Notify Navigator Priya Sharma — alert sent',
        'Navigator to call patient and assess pain location',
        'Review current pain management with oncologist if needed',
        'Document outcome and update acuity score',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log('Playbooks created.');

  // 7. Sample documents + draft tasks (so navigator drafts review has content)
  const fakeGridFsId = () => new mongoose.Types.ObjectId();

  const sunitaDocResult = await db.collection('document_metas').insertOne({
    patientId: patientIds['Sunita Devi'],
    uploadedByUserId: patientIds['Sunita Devi'],
    category: 'lab',
    fileName: 'blood_test_report_april.pdf',
    mimeType: 'application/pdf',
    fileSize: 184320,
    gridfsId: fakeGridFsId(),
    processingStatus: 'complete',
    processingError: '',
    draftTaskCount: 3,
    createdAt: at(7, 28),
    updatedAt: at(7, 28),
  });

  const ramaiahDocResult = await db.collection('document_metas').insertOne({
    patientId: patientIds['Ramaiah G.'],
    uploadedByUserId: patientIds['Ramaiah G.'],
    category: 'discharge',
    fileName: 'discharge_summary_march.pdf',
    mimeType: 'application/pdf',
    fileSize: 98510,
    gridfsId: fakeGridFsId(),
    processingStatus: 'complete',
    processingError: '',
    draftTaskCount: 2,
    createdAt: at(8, 50),
    updatedAt: at(8, 50),
  });

  const inDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    d.setHours(10, 0, 0, 0);
    return d;
  };

  await db.collection('tasks').insertMany([
    {
      patientId: patientIds['Sunita Devi'],
      type: 'test',
      title: 'CBC blood test before next chemo session',
      date: inDays(3),
      status: 'draft',
      sourceDocumentId: sunitaDocResult.insertedId,
      createdAt: at(7, 30),
      updatedAt: at(7, 30),
    },
    {
      patientId: patientIds['Sunita Devi'],
      type: 'visit',
      title: 'Follow-up visit with oncologist',
      date: inDays(7),
      status: 'draft',
      sourceDocumentId: sunitaDocResult.insertedId,
      createdAt: at(7, 30),
      updatedAt: at(7, 30),
    },
    {
      patientId: patientIds['Sunita Devi'],
      type: 'test',
      title: 'Liver function panel',
      date: inDays(10),
      status: 'draft',
      sourceDocumentId: sunitaDocResult.insertedId,
      createdAt: at(7, 30),
      updatedAt: at(7, 30),
    },
    {
      patientId: patientIds['Ramaiah G.'],
      type: 'visit',
      title: 'Post-discharge wound check',
      date: inDays(2),
      status: 'draft',
      sourceDocumentId: ramaiahDocResult.insertedId,
      createdAt: at(8, 52),
      updatedAt: at(8, 52),
    },
    {
      patientId: patientIds['Ramaiah G.'],
      type: 'test',
      title: 'CT scan follow-up',
      date: inDays(14),
      status: 'draft',
      sourceDocumentId: ramaiahDocResult.insertedId,
      createdAt: at(8, 52),
      updatedAt: at(8, 52),
    },
  ]);
  console.log('Documents + draft tasks created.');

  console.log('\n--- Seed Complete ---');
  console.log(`Navigator ID (Priya Sharma): ${navigatorId}`);
  Object.entries(patientIds).forEach(([n, id]) => console.log(`  ${n}: ${id}`));
  console.log(`\nLogin: phone 1111111111 (navigator) / 2222222222 (Ravi) / 6666666666 (Lakshmi - caregiver) — OTP 1234`);
  console.log(`Admin login: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
