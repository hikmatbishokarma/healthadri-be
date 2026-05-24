import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@healthadri.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'changeme123';

async function seed() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  await db.dropDatabase();
  console.log('Database cleared.');

  const now = new Date();
  const year = now.getFullYear();
  const code = (n: number) => `HA-${year}-${100000 + n}`;

  const daysAgo = (n: number, h: number, m = 0) => {
    const d = new Date(now); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d;
  };
  const daysAhead = (n: number, h: number, m = 0) => {
    const d = new Date(now); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d;
  };
  const weeksAgo = (n: number, h = 9) => {
    const d = new Date(now); d.setDate(d.getDate() - n * 7); d.setHours(h, 0, 0, 0); return d;
  };

  // Helper: insert reminder events for a task with a given adherence pattern
  async function insertReminders(opts: {
    patientId: mongoose.Types.ObjectId;
    taskId: mongoose.Types.ObjectId;
    versionId: mongoose.Types.ObjectId;
    taskType: string; taskTitle: string;
    times: string[];           // e.g. ['08:00', '20:00']
    historyDays: number;
    missedDays: Set<number>;   // which past days (1=yesterday, N=oldest) are missed
    futureDays: number;
  }) {
    for (let d = opts.historyDays; d >= 1; d--) {
      const isMissed = opts.missedDays.has(d);
      const status = isMissed ? 'MISSED' : 'PATIENT_CONFIRMED';
      for (const time of opts.times) {
        const [h, m] = time.split(':').map(Number);
        const scheduledAt = daysAgo(d, h, m);
        await db.collection('reminderevents').insertOne({
          patientId: opts.patientId, carePlanTaskId: opts.taskId,
          carePlanVersionId: opts.versionId,
          scheduledAt, sentAt: scheduledAt, status,
          response: isMissed ? null : 'TAKEN',
          respondedAt: isMissed ? null : scheduledAt,
          snoozedUntil: null, escalationLevel: 'NONE',
          taskType: opts.taskType, taskTitle: opts.taskTitle,
          createdAt: scheduledAt, updatedAt: scheduledAt,
        });
      }
    }
    for (let d = 1; d <= opts.futureDays; d++) {
      for (const time of opts.times) {
        const [h, m] = time.split(':').map(Number);
        const scheduledAt = daysAhead(d, h, m);
        await db.collection('reminderevents').insertOne({
          patientId: opts.patientId, carePlanTaskId: opts.taskId,
          carePlanVersionId: opts.versionId,
          scheduledAt, sentAt: null, status: 'PENDING',
          response: null, respondedAt: null,
          snoozedUntil: null, escalationLevel: 'NONE',
          taskType: opts.taskType, taskTitle: opts.taskTitle,
          createdAt: scheduledAt, updatedAt: scheduledAt,
        });
      }
    }
  }

  // ── 1. Hospitals ──────────────────────────────────────────────────────────────
  const hospitals = await db.collection('hospitals').insertMany([
    { name: 'City Cancer Center', city: 'Hyderabad', tags: ['oncology', 'surgery'] },
    { name: 'Memorial Hospital', city: 'Bengaluru', tags: ['oncology', 'radiation'] },
    { name: 'Health First Clinic', city: 'Chennai', tags: ['general', 'oncology'] },
  ]);
  const cityCancerCenterId = hospitals.insertedIds[0];
  console.log('Hospitals created.');

  // ── 2. Super-admin ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await db.collection('users').insertOne({
    name: 'Super Admin', phone: '', role: 'super-admin',
    email: SUPER_ADMIN_EMAIL.toLowerCase().trim(), passwordHash,
    assignedNavigatorId: null, cancerType: '', cancerStage: '', avatar: '',
    profileCompleted: true, gender: '', hospitalName: '', hospitalId: null,
    languages: [], chemoSessionsCompleted: 0, chemoSessionsTotal: 0, acuityScore: 0,
    activeCarePlanVersionId: null, createdAt: new Date(), updatedAt: new Date(),
  });

  // ── 3. Navigator ──────────────────────────────────────────────────────────────
  const navHash = await bcrypt.hash('navigator123', 10);
  const navResult = await db.collection('users').insertOne({
    name: 'Priya Sharma', phone: '1111111111', email: 'navigator@gmail.com',
    passwordHash: navHash, role: 'navigator',
    assignedNavigatorId: null, cancerType: '', cancerStage: '', avatar: '',
    profileCompleted: true, gender: 'female',
    hospitalName: 'City Cancer Center', hospitalId: cityCancerCenterId,
    languages: ['English', 'Hindi', 'Telugu'],
    chemoSessionsCompleted: 0, chemoSessionsTotal: 0, acuityScore: 0,
    activeCarePlanVersionId: null, createdAt: new Date(), updatedAt: new Date(),
  });
  const navigatorId = navResult.insertedId;
  console.log('Navigator created: navigator@gmail.com / navigator123');

  // ── 4. Symptoms ───────────────────────────────────────────────────────────────
  const syms = await db.collection('symptoms').insertMany([
    { name: 'Pain Level',  type: 'scale', min: 0, max: 10, threshold: 6 },
    { name: 'Fatigue',     type: 'scale', min: 0, max: 10, threshold: 7 },
    { name: 'Nausea',      type: 'scale', min: 0, max: 10, threshold: 6 },
    { name: 'Appetite',    type: 'scale', min: 0, max: 10, threshold: 4 },
    { name: 'Fever',       type: 'scale', min: 0, max: 10, threshold: 5 },
  ]);
  const [painId, fatigueId, nauseaId, , feverId] = Object.values(syms.insertedIds);

  // ── 5. Patients (10) ──────────────────────────────────────────────────────────
  const mkPatient = (name: string, phone: string, gender: string,
    cancerType: string, cancerStage: string, chemoCompleted: number, chemoTotal: number,
    acuityScore: number, languages: string[], patientIdx: number,
    cgPhone = '', cgRel = '',
  ) => ({
    name, phone, role: 'patient', assignedNavigatorId: navigatorId,
    cancerType, cancerStage, avatar: '', profileCompleted: true,
    age: 40 + patientIdx * 3, gender,
    hospitalName: 'City Cancer Center', hospitalId: cityCancerCenterId,
    patientCode: code(patientIdx),
    languages, chemoSessionsCompleted: chemoCompleted, chemoSessionsTotal: chemoTotal,
    acuityScore, caregiverPhone: cgPhone, caregiverRelationship: cgRel,
    activeCarePlanVersionId: null, createdAt: new Date(), updatedAt: new Date(),
  });

  // ── STABLE patients (1–3) ─────────────────────────────────────────────────────
  const padmaResult = await db.collection('users').insertOne(mkPatient(
    'Padma Reddy', '5555555555', 'female',
    'Cervical Cancer', 'Stage I', 1, 4, 3.2, ['Telugu', 'English'], 1,
  ));
  const vijayResult = await db.collection('users').insertOne(mkPatient(
    'Vijay Nair', '8888888888', 'male',
    'Prostate Cancer', 'Stage II', 0, 0, 2.8, ['Telugu', 'English'], 2,
  ));
  const anithaResult = await db.collection('users').insertOne(mkPatient(
    'Anitha Kumari', '9999999999', 'female',
    'Thyroid Cancer', 'Stage II', 0, 0, 2.1, ['Telugu', 'Hindi'], 3,
  ));

  // ── ACTIVE ONCOLOGY patients (4–6) ────────────────────────────────────────────
  const raviResult = await db.collection('users').insertOne(mkPatient(
    'Ravi Kumar', '2222222222', 'male',
    'Oral Cancer', 'Stage II', 12, 18, 7.4, ['Telugu', 'English'], 4,
    '6666666666', 'Spouse',
  ));
  const sunitaResult = await db.collection('users').insertOne(mkPatient(
    'Sunita Devi', '3333333333', 'female',
    'Breast Cancer', 'Stage III', 4, 8, 8.1, ['Hindi', 'English'], 5,
    '7777777777', 'Spouse',
  ));
  const krishResult = await db.collection('users').insertOne(mkPatient(
    'Krishnamurthy P.', '1010101010', 'male',
    'Lung Cancer', 'Stage III', 5, 8, 8.6, ['Telugu', 'English'], 6,
  ));

  // ── NON-ADHERENT patients (7–8) ───────────────────────────────────────────────
  const ramaiahResult = await db.collection('users').insertOne(mkPatient(
    'Ramaiah G.', '4444444444', 'male',
    'Colorectal Cancer', 'Stage II', 2, 6, 5.5, ['Telugu'], 7,
  ));
  const meenaResult = await db.collection('users').insertOne(mkPatient(
    'Meena Kumari', '1212121212', 'female',
    'Ovarian Cancer', 'Stage III', 3, 6, 7.9, ['Telugu', 'Hindi'], 8,
    '1515151515', 'Son',
  ));

  // ── HIGH-RISK patients (9–10) ─────────────────────────────────────────────────
  const sureshResult = await db.collection('users').insertOne(mkPatient(
    'Suresh Babu', '1313131313', 'male',
    'Gastric Cancer', 'Stage IV', 3, 12, 9.2, ['Telugu'], 9,
    '1616161616', 'Spouse',
  ));
  const radhaResult = await db.collection('users').insertOne(mkPatient(
    'Radha Bai', '1414141414', 'female',
    'Cervical Cancer', 'Stage III', 2, 6, 8.8, ['Telugu', 'Hindi'], 10,
    '1717171717', 'Husband',
  ));

  const padmaId = padmaResult.insertedId;
  const vijayId = vijayResult.insertedId;
  const anithaId = anithaResult.insertedId;
  const raviId = raviResult.insertedId;
  const sunitaId = sunitaResult.insertedId;
  const krishId = krishResult.insertedId;
  const ramaiahId = ramaiahResult.insertedId;
  const meenaId = meenaResult.insertedId;
  const sureshId = sureshResult.insertedId;
  const radhaId = radhaResult.insertedId;
  console.log('10 patients created.');

  // ── 6. Caregivers ─────────────────────────────────────────────────────────────
  const mkCaregiver = (name: string, phone: string, gender: string, linkedId: mongoose.Types.ObjectId, rel: string) => ({
    name, phone, role: 'caregiver', linkedPatientId: linkedId,
    assignedNavigatorId: null, cancerType: '', cancerStage: '', avatar: '',
    profileCompleted: false, age: 40, gender,
    hospitalName: '', hospitalId: null, patientCode: null,
    languages: ['Telugu', 'English'],
    chemoSessionsCompleted: 0, chemoSessionsTotal: 0, acuityScore: 0,
    caregiverRelationship: rel, activeCarePlanVersionId: null,
    createdAt: new Date(), updatedAt: new Date(),
  });

  await db.collection('users').insertMany([
    mkCaregiver('Lakshmi Kumar', '6666666666', 'female', raviId, 'Spouse'),
    mkCaregiver('Rajesh Devi', '7777777777', 'male', sunitaId, 'Spouse'),
    mkCaregiver('Pradeep Kumari', '1515151515', 'male', meenaId, 'Son'),
    mkCaregiver('Kamala Babu', '1616161616', 'female', sureshId, 'Spouse'),
    mkCaregiver('Sekhar Bai', '1717171717', 'male', radhaId, 'Husband'),
  ]);
  console.log('Caregivers created.');

  // ── 7. Symptoms entries + Alerts ──────────────────────────────────────────────
  const at = (h: number, m = 0) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d; };

  // Stable patients — mild symptoms, LOW alerts
  await db.collection('symptomentries').insertOne({
    patientId: padmaId,
    responses: [{ symptomId: fatigueId, name: 'Fatigue', value: 4 }],
    createdAt: daysAgo(1, 9), updatedAt: daysAgo(1, 9),
  });
  await db.collection('symptomentries').insertOne({
    patientId: vijayId,
    responses: [{ symptomId: painId, name: 'Pain Level', value: 3 }],
    createdAt: daysAgo(1, 8), updatedAt: daysAgo(1, 8),
  });
  await db.collection('symptomentries').insertOne({
    patientId: anithaId,
    responses: [{ symptomId: fatigueId, name: 'Fatigue', value: 3 }],
    createdAt: daysAgo(1, 10), updatedAt: daysAgo(1, 10),
  });

  // Active oncology — notable symptoms, HIGH/MED alerts
  await db.collection('symptomentries').insertOne({
    patientId: raviId,
    responses: [{ symptomId: fatigueId, name: 'Fatigue', value: 7 }],
    createdAt: at(8, 42), updatedAt: at(8, 42),
  });
  await db.collection('alerts').insertOne({
    patientId: raviId, navigatorId, type: 'HIGH_FATIGUE',
    severity: 'HIGH', reason: 'Fatigue 7/10 — possible chemo-related exhaustion',
    status: 'pending', createdAt: at(8, 42), updatedAt: at(8, 42),
  });

  await db.collection('symptomentries').insertOne({
    patientId: sunitaId,
    responses: [{ symptomId: feverId, name: 'Fever', value: 8 }],
    createdAt: at(7, 30), updatedAt: at(7, 30),
  });
  await db.collection('alerts').insertOne({
    patientId: sunitaId, navigatorId, type: 'HIGH_FEVER',
    severity: 'HIGH', reason: 'Fever 38.5°C — day 3 of chemo cycle',
    status: 'pending', createdAt: at(7, 30), updatedAt: at(7, 30),
  });

  await db.collection('symptomentries').insertOne({
    patientId: krishId,
    responses: [{ symptomId: nauseaId, name: 'Nausea', value: 7 }, { symptomId: fatigueId, name: 'Fatigue', value: 8 }],
    createdAt: at(9, 15), updatedAt: at(9, 15),
  });
  await db.collection('alerts').insertOne({
    patientId: krishId, navigatorId, type: 'HIGH_FATIGUE',
    severity: 'MED', reason: 'Nausea 7/10 + Fatigue 8/10 — cycle 5 day 2',
    status: 'pending', createdAt: at(9, 15), updatedAt: at(9, 15),
  });

  // Non-adherent — missed appointment alerts
  await db.collection('alerts').insertOne({
    patientId: ramaiahId, navigatorId, type: 'MISSED_APPOINTMENT',
    severity: 'MED', reason: 'Missed surgical follow-up — rescheduling needed',
    status: 'pending', createdAt: at(9, 0), updatedAt: at(9, 0),
  });
  await db.collection('symptomentries').insertOne({
    patientId: meenaId,
    responses: [{ symptomId: nauseaId, name: 'Nausea', value: 6 }],
    createdAt: daysAgo(2, 9), updatedAt: daysAgo(2, 9),
  });
  await db.collection('alerts').insertOne({
    patientId: meenaId, navigatorId, type: 'HIGH_NAUSEA',
    severity: 'MED', reason: 'Nausea 6/10 — anti-nausea medication adherence concern',
    status: 'pending', createdAt: daysAgo(2, 9), updatedAt: daysAgo(2, 9),
  });

  // High-risk — multiple HIGH alerts
  await db.collection('symptomentries').insertOne({
    patientId: sureshId,
    responses: [{ symptomId: feverId, name: 'Fever', value: 9 }, { symptomId: painId, name: 'Pain Level', value: 8 }],
    createdAt: daysAgo(0, 7, 45), updatedAt: daysAgo(0, 7, 45),
  });
  await db.collection('alerts').insertOne({
    patientId: sureshId, navigatorId, type: 'HIGH_FEVER',
    severity: 'HIGH', reason: 'Fever 39.2°C + Pain 8/10 — possible neutropenic fever',
    status: 'pending', createdAt: daysAgo(0, 7, 45), updatedAt: daysAgo(0, 7, 45),
  });
  await db.collection('alerts').insertOne({
    patientId: sureshId, navigatorId, type: 'HIGH_PAIN_LEVEL',
    severity: 'HIGH', reason: 'Pain 8/10 — breakthrough pain protocol required',
    status: 'pending', createdAt: daysAgo(0, 7, 50), updatedAt: daysAgo(0, 7, 50),
  });

  await db.collection('symptomentries').insertOne({
    patientId: radhaId,
    responses: [{ symptomId: painId, name: 'Pain Level', value: 7 }, { symptomId: fatigueId, name: 'Fatigue', value: 7 }],
    createdAt: daysAgo(1, 8, 30), updatedAt: daysAgo(1, 8, 30),
  });
  await db.collection('alerts').insertOne({
    patientId: radhaId, navigatorId, type: 'HIGH_PAIN_LEVEL',
    severity: 'HIGH', reason: 'Pain 7/10 + missed PET scan follow-up 3 days overdue',
    status: 'pending', createdAt: daysAgo(1, 8, 30), updatedAt: daysAgo(1, 8, 30),
  });

  // Low alerts for stable patients
  await db.collection('alerts').insertOne({
    patientId: padmaId, navigatorId, type: 'HIGH_FATIGUE',
    severity: 'LOW', reason: 'Fatigue 4/10 — within normal range post-chemo',
    status: 'resolved', createdAt: daysAgo(2, 9), updatedAt: daysAgo(1, 10),
  });
  console.log('Symptom entries + alerts created.');

  // ── 8. Playbooks ──────────────────────────────────────────────────────────────
  await db.collection('playbooks').insertMany([
    {
      triggerType: 'HIGH_FATIGUE', title: 'High Fatigue Protocol', autoCompletedCount: 3,
      steps: [
        'AI detected fatigue score ≥7 in symptom check-in',
        'Notify Navigator Priya Sharma — alert sent',
        'AI tips sent to patient via app chat',
        'Navigator to call patient within 2 hours — confirm fatigue cause',
        'If fever >38°C or pain >8/10 — escalate to oncologist immediately',
        'Document outcome and update acuity score',
      ],
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      triggerType: 'HIGH_FEVER', title: 'Fever / Neutropenic Protocol', autoCompletedCount: 2,
      steps: [
        'AI detected fever ≥38°C in symptom check-in',
        'Notify Navigator immediately — possible neutropenic fever',
        'Navigator to call patient within 1 hour — confirm temperature and ANC from last CBC',
        'If fever ≥38.5°C — advise immediate ER visit, alert oncologist',
        'Coordinate same-day CBC and blood cultures',
        'Document outcome and update care plan',
      ],
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      triggerType: 'MISSED_APPOINTMENT', title: 'Missed Appointment Protocol', autoCompletedCount: 1,
      steps: [
        'System detected missed scheduled appointment',
        'Navigator to contact patient within 4 hours',
        'Reschedule appointment within the same week if chemo-related',
        'Document reason and update care plan',
      ],
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      triggerType: 'HIGH_PAIN_LEVEL', title: 'Breakthrough Pain Protocol', autoCompletedCount: 2,
      steps: [
        'AI detected pain score ≥6',
        'Notify Navigator — assess pain location and character',
        'Review current analgesic regimen with oncologist if pain ≥7',
        'Coordinate rescue dose or palliative consult if breakthrough',
        'Document outcome',
      ],
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      triggerType: 'HIGH_NAUSEA', title: 'Nausea Management Protocol', autoCompletedCount: 2,
      steps: [
        'AI detected nausea score ≥6 — likely chemo-induced nausea',
        'Confirm adherence to anti-emetic regimen',
        'Navigator to advise dietary modifications',
        'Escalate to oncologist if antiemetics not controlling symptoms',
        'Update care plan anti-nausea medication if needed',
      ],
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]);
  console.log('Playbooks created.');

  // ── 9. Documents ──────────────────────────────────────────────────────────────
  const fakeGridFsId = () => new mongoose.Types.ObjectId();

  const raviDocResult = await db.collection('document_metas').insertOne({
    patientId: raviId, uploadedByUserId: raviId,
    category: 'lab', fileName: 'oral_cancer_cycle13_protocol.pdf',
    mimeType: 'application/pdf', fileSize: 212480,
    gridfsId: fakeGridFsId(), processingStatus: 'complete',
    processingError: '', draftTaskCount: 3, reviewBatchId: null,
    createdAt: daysAgo(2, 11), updatedAt: daysAgo(2, 11),
  });
  const sunitaDocResult = await db.collection('document_metas').insertOne({
    patientId: sunitaId, uploadedByUserId: sunitaId,
    category: 'lab', fileName: 'breast_cancer_bloodwork_may.pdf',
    mimeType: 'application/pdf', fileSize: 184320,
    gridfsId: fakeGridFsId(), processingStatus: 'complete',
    processingError: '', draftTaskCount: 3, reviewBatchId: null,
    createdAt: at(7, 28), updatedAt: at(7, 28),
  });
  const krishDocResult = await db.collection('document_metas').insertOne({
    patientId: krishId, uploadedByUserId: krishId,
    category: 'scan', fileName: 'pet_scan_cycle5_response.pdf',
    mimeType: 'application/pdf', fileSize: 356000,
    gridfsId: fakeGridFsId(), processingStatus: 'complete',
    processingError: '', draftTaskCount: 2, reviewBatchId: null,
    createdAt: daysAgo(1, 14), updatedAt: daysAgo(1, 14),
  });
  const ramaiahDocResult = await db.collection('document_metas').insertOne({
    patientId: ramaiahId, uploadedByUserId: ramaiahId,
    category: 'discharge', fileName: 'discharge_summary_colorectal.pdf',
    mimeType: 'application/pdf', fileSize: 98510,
    gridfsId: fakeGridFsId(), processingStatus: 'complete',
    processingError: '', draftTaskCount: 2, reviewBatchId: null,
    createdAt: at(8, 50), updatedAt: at(8, 50),
  });
  console.log('Documents created.');

  // ── 10. Care Plans (all 10 patients) ─────────────────────────────────────────

  // ── Padma Reddy — v1 ACTIVE (Carboplatin weekly infusion) ────────────────────
  const padmaV1Result = await db.collection('careplanversions').insertOne({
    patientId: padmaId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(3), effectiveFrom: weeksAgo(3),
    publishedById: navigatorId, notes: 'Initial chemo-radiation plan. Concurrent cisplatin + radiotherapy.',
    sourceBatchId: null, createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });
  const padmaV1Id = padmaV1Result.insertedId;

  const padmaCapTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: padmaV1Id, patientId: padmaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Carboplatin 300mg — weekly infusion',
    severity: 'HIGH', startDate: weeksAgo(3), endDate: daysAhead(28, 9), status: 'ACTIVE',
    instructions: 'IV infusion at chemo day care unit every Monday. Pre-hydrate 500ml NS. Monitor CBC before each cycle.',
    taskData: { medicineName: 'Carboplatin', dosage: '300mg', frequency: 'Weekly infusion', timing: 'Monday 09:00' },
    schedule: { times: ['09:00'], intervalDays: 7 },
    createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: padmaV1Id, patientId: padmaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'CBC + LFT before each cycle',
    severity: 'HIGH', startDate: weeksAgo(3), endDate: daysAhead(35, 9), status: 'ACTIVE',
    instructions: 'Full blood count and liver function panel required 1 day before each infusion.',
    taskData: { testName: 'CBC + Liver Function Panel', labName: 'City Cancer Center Pathology', notes: '1 day before each Carboplatin infusion' },
    schedule: null, createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });

  // ── Vijay Nair — v1 ACTIVE (Prostate hormone therapy) ────────────────────────
  const vijayV1Result = await db.collection('careplanversions').insertOne({
    patientId: vijayId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(8), effectiveFrom: weeksAgo(8),
    publishedById: navigatorId, notes: 'Androgen deprivation therapy post-prostatectomy.',
    sourceBatchId: null, createdAt: weeksAgo(8), updatedAt: weeksAgo(8),
  });
  const vijayV1Id = vijayV1Result.insertedId;

  const vijayMedTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: vijayV1Id, patientId: vijayId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Bicalutamide 50mg — once daily',
    severity: 'HIGH', startDate: weeksAgo(8), endDate: daysAhead(180, 8), status: 'ACTIVE',
    instructions: 'Take at the same time every morning with food. Report any gynaecomastia or hot flushes.',
    taskData: { medicineName: 'Bicalutamide', dosage: '50mg', frequency: 'Once daily', timing: '08:00' },
    schedule: { times: ['08:00'], intervalDays: 1 },
    createdAt: weeksAgo(8), updatedAt: weeksAgo(8),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: vijayV1Id, patientId: vijayId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'PSA + Testosterone — every 3 months',
    severity: 'MEDIUM', startDate: daysAhead(21, 8), endDate: null, status: 'ACTIVE',
    instructions: 'PSA and serum testosterone to monitor ADT response.',
    taskData: { testName: 'PSA + Serum Testosterone', frequency: 'Every 3 months', labName: 'City Cancer Center Pathology' },
    schedule: null, createdAt: weeksAgo(8), updatedAt: weeksAgo(8),
  });

  // ── Anitha Kumari — v1 ACTIVE (post-thyroidectomy Levothyroxine) ──────────────
  const anithaV1Result = await db.collection('careplanversions').insertOne({
    patientId: anithaId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(6), effectiveFrom: weeksAgo(6),
    publishedById: navigatorId, notes: 'Post-total thyroidectomy hormone replacement + RAI suppression.',
    sourceBatchId: null, createdAt: weeksAgo(6), updatedAt: weeksAgo(6),
  });
  const anithaV1Id = anithaV1Result.insertedId;

  const anithaLevoTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: anithaV1Id, patientId: anithaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Levothyroxine 100mcg — once daily (fasting)',
    severity: 'HIGH', startDate: weeksAgo(6), endDate: daysAhead(365, 7), status: 'ACTIVE',
    instructions: 'Take 30 minutes before breakfast on an empty stomach. Do NOT take with calcium or iron supplements.',
    taskData: { medicineName: 'Levothyroxine', dosage: '100mcg', frequency: 'Once daily fasting', timing: '07:00' },
    schedule: { times: ['07:00'], intervalDays: 1 },
    createdAt: weeksAgo(6), updatedAt: weeksAgo(6),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: anithaV1Id, patientId: anithaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'TSH + Free T4 — monthly',
    severity: 'MEDIUM', startDate: daysAhead(7, 9), endDate: null, status: 'ACTIVE',
    instructions: 'Monitor TSH suppression (target TSH <0.1 for high-risk) and T4 levels monthly.',
    taskData: { testName: 'TSH + Free T4', frequency: 'Monthly', labName: 'City Cancer Center Pathology' },
    schedule: null, createdAt: weeksAgo(6), updatedAt: weeksAgo(6),
  });

  // ── Ravi Kumar — v1 SUPERSEDED + v2 ACTIVE ───────────────────────────────────
  const raviV1Result = await db.collection('careplanversions').insertOne({
    patientId: raviId, versionNumber: 1, previousVersionId: null, status: 'SUPERSEDED',
    publishedAt: weeksAgo(6), effectiveFrom: weeksAgo(6),
    publishedById: navigatorId, notes: 'Initial plan — Cisplatin/5-FU cycles 1–12.',
    sourceBatchId: null, createdAt: weeksAgo(6), updatedAt: weeksAgo(3),
  });
  const raviV2Result = await db.collection('careplanversions').insertOne({
    patientId: raviId, versionNumber: 2, previousVersionId: raviV1Result.insertedId, status: 'ACTIVE',
    publishedAt: weeksAgo(3), effectiveFrom: weeksAgo(3),
    publishedById: navigatorId,
    notes: 'Updated after cycle 12 — switched to Capecitabine maintenance + Ondansetron. Added CBC schedule.',
    sourceBatchId: null, createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });
  const raviV2Id = raviV2Result.insertedId;

  const raviCapTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: raviV2Id, patientId: raviId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Capecitabine 500mg — twice daily',
    severity: 'HIGH', startDate: weeksAgo(3), endDate: daysAhead(42, 8), status: 'ACTIVE',
    instructions: 'Take with food. Report hand-foot syndrome (redness/blistering on palms/soles), diarrhoea, or nausea >5/10 immediately.',
    taskData: { medicineName: 'Capecitabine', dosage: '500mg', frequency: 'Twice daily (14 days on, 7 days off)', timing: '08:00, 20:00' },
    schedule: { times: ['08:00', '20:00'], intervalDays: 1 },
    createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: raviV2Id, patientId: raviId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Ondansetron 4mg — anti-nausea, 30 min before Capecitabine',
    severity: 'MEDIUM', startDate: weeksAgo(3), endDate: daysAhead(42, 8), status: 'ACTIVE',
    instructions: 'Take 30 minutes before morning Capecitabine dose. May cause drowsiness — avoid driving.',
    taskData: { medicineName: 'Ondansetron', dosage: '4mg', frequency: 'Once daily', timing: '07:30' },
    schedule: { times: ['07:30'], intervalDays: 1 },
    createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: raviV2Id, patientId: raviId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'CBC with differential — 3 days before cycle 13',
    severity: 'HIGH', startDate: daysAhead(4, 8), endDate: null, status: 'ACTIVE',
    instructions: 'Complete blood count required before starting next Capecitabine cycle. ANC must be ≥1.5 × 10⁹/L.',
    taskData: { testName: 'CBC with differential', labName: 'City Cancer Center Pathology', notes: 'Required before cycle 13 start' },
    schedule: null, createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: raviV2Id, patientId: raviId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'APPOINTMENT', title: 'Oncologist review — cycle 13 assessment',
    severity: 'MEDIUM', startDate: daysAhead(7, 10), endDate: null, status: 'ACTIVE',
    instructions: 'Bring CBC results and symptom diary. Dr. Anand Rao, OPD Block C, City Cancer Center.',
    taskData: { doctorName: 'Dr. Anand Rao', specialty: 'Medical Oncology', location: 'OPD Block C' },
    schedule: null, createdAt: weeksAgo(3), updatedAt: weeksAgo(3),
  });

  // ── Sunita Devi — v1 ACTIVE + v2 DRAFT from batch ────────────────────────────
  const sunitaV1Result = await db.collection('careplanversions').insertOne({
    patientId: sunitaId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(2), effectiveFrom: weeksAgo(2),
    publishedById: navigatorId, notes: 'Post-surgical hormone therapy. Chemo cycles 5–8 starting next month.',
    sourceBatchId: null, createdAt: weeksAgo(2), updatedAt: weeksAgo(2),
  });
  const sunitaV1Id = sunitaV1Result.insertedId;

  const sunitaTamTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: sunitaV1Id, patientId: sunitaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Tamoxifen 20mg — once daily',
    severity: 'HIGH', startDate: weeksAgo(2), endDate: daysAhead(365 * 5, 9), status: 'ACTIVE',
    instructions: 'Take at the same time every day. Report abnormal bleeding, visual changes, or leg pain immediately.',
    taskData: { medicineName: 'Tamoxifen', dosage: '20mg', frequency: 'Once daily', timing: '09:00' },
    schedule: { times: ['09:00'], intervalDays: 1 },
    createdAt: weeksAgo(2), updatedAt: weeksAgo(2),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: sunitaV1Id, patientId: sunitaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'CBC before chemo cycle 5 — 3 days prior',
    severity: 'HIGH', startDate: daysAhead(4, 9), endDate: null, status: 'ACTIVE',
    instructions: 'Full blood count + liver function required 3 days before cycle 5.',
    taskData: { testName: 'CBC + LFT', notes: '3 days before chemo cycle 5', labName: 'City Cancer Center Pathology' },
    schedule: null, createdAt: weeksAgo(2), updatedAt: weeksAgo(2),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: sunitaV1Id, patientId: sunitaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'Bone density scan (DEXA) — baseline',
    severity: 'MEDIUM', startDate: daysAhead(28, 9), endDate: null, status: 'ACTIVE',
    instructions: 'Baseline bone density scan — tamoxifen side effect monitoring.',
    taskData: { testName: 'DEXA Scan', location: 'Radiology, City Cancer Center' },
    schedule: null, createdAt: weeksAgo(2), updatedAt: weeksAgo(2),
  });

  // Sunita v2 DRAFT from review batch (created after batch review)
  const sunitaV2Result = await db.collection('careplanversions').insertOne({
    patientId: sunitaId, versionNumber: 2, previousVersionId: sunitaV1Id, status: 'DRAFT',
    publishedAt: null, effectiveFrom: null, publishedById: null,
    notes: 'AI-extracted from May bloodwork report. Capecitabine cycle 5 protocol pending review.',
    sourceBatchId: null, // updated below
    createdAt: at(7, 30), updatedAt: at(7, 30),
  });
  const sunitaV2Id = sunitaV2Result.insertedId;

  // ── Krishnamurthy P. — v1 SUPERSEDED + v2 ACTIVE ─────────────────────────────
  const krishV1Result = await db.collection('careplanversions').insertOne({
    patientId: krishId, versionNumber: 1, previousVersionId: null, status: 'SUPERSEDED',
    publishedAt: weeksAgo(10), effectiveFrom: weeksAgo(10),
    publishedById: navigatorId, notes: 'Initial plan — Carboplatin+Pemetrexed cycles 1–3.',
    sourceBatchId: null, createdAt: weeksAgo(10), updatedAt: weeksAgo(4),
  });
  const krishV2Result = await db.collection('careplanversions').insertOne({
    patientId: krishId, versionNumber: 2, previousVersionId: krishV1Result.insertedId, status: 'ACTIVE',
    publishedAt: weeksAgo(4), effectiveFrom: weeksAgo(4),
    publishedById: navigatorId,
    notes: 'Added Bevacizumab 15mg/kg after partial response at cycle 3. Pemetrexed maintenance continuing.',
    sourceBatchId: null, createdAt: weeksAgo(4), updatedAt: weeksAgo(4),
  });
  const krishV2Id = krishV2Result.insertedId;

  const krishCarbTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: krishV2Id, patientId: krishId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Carboplatin AUC5 + Pemetrexed 500mg/m² — q3w infusion',
    severity: 'HIGH', startDate: weeksAgo(4), endDate: daysAhead(90, 9), status: 'ACTIVE',
    instructions: 'IV infusion at day care unit every 21 days. Folic acid 400mcg daily + B12 1000mcg q9w supplementation mandatory.',
    taskData: { medicineName: 'Carboplatin + Pemetrexed', dosage: 'AUC5 + 500mg/m²', frequency: 'Every 21 days', timing: 'Day care unit 09:00' },
    schedule: { times: ['09:00'], intervalDays: 1 },
    createdAt: weeksAgo(4), updatedAt: weeksAgo(4),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: krishV2Id, patientId: krishId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Bevacizumab 15mg/kg — added cycle 4 (partial response)',
    severity: 'HIGH', startDate: weeksAgo(4), endDate: daysAhead(90, 9), status: 'ACTIVE',
    instructions: 'Added after partial response at cycle 3 PET scan. Monitor BP before each dose. Stop if uncontrolled hypertension.',
    taskData: { medicineName: 'Bevacizumab', dosage: '15mg/kg IV', frequency: 'Every 21 days with Carboplatin+Pemetrexed', notes: 'Monitor BP; check urine protein' },
    schedule: { times: ['09:30'], intervalDays: 1 },
    createdAt: weeksAgo(4), updatedAt: weeksAgo(4),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: krishV2Id, patientId: krishId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Dexamethasone 4mg — anti-nausea, day before + day of infusion',
    severity: 'MEDIUM', startDate: weeksAgo(4), endDate: daysAhead(90, 8), status: 'ACTIVE',
    instructions: 'Prophylactic dexamethasone to prevent pemetrexed-related rash and nausea.',
    taskData: { medicineName: 'Dexamethasone', dosage: '4mg', frequency: 'Day -1, day 0, day +1 of each cycle' },
    schedule: { times: ['08:00'], intervalDays: 1 },
    createdAt: weeksAgo(4), updatedAt: weeksAgo(4),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: krishV2Id, patientId: krishId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'CBC + CMP + urine protein — before each cycle',
    severity: 'HIGH', startDate: daysAhead(3, 9), endDate: null, status: 'ACTIVE',
    instructions: 'Comprehensive metabolic panel and urine protein-to-creatinine ratio required before each Bevacizumab dose.',
    taskData: { testName: 'CBC + CMP + urine protein:creatinine', notes: 'Required before every q3w cycle', labName: 'City Cancer Center Pathology' },
    schedule: null, createdAt: weeksAgo(4), updatedAt: weeksAgo(4),
  });

  // ── Ramaiah G. — v1 ACTIVE ────────────────────────────────────────────────────
  const ramaiahV1Result = await db.collection('careplanversions').insertOne({
    patientId: ramaiahId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(1), effectiveFrom: weeksAgo(1),
    publishedById: navigatorId, notes: 'Post-operative care plan — adjuvant Capecitabine.',
    sourceBatchId: null, createdAt: weeksAgo(1), updatedAt: weeksAgo(1),
  });
  const ramaiahV1Id = ramaiahV1Result.insertedId;

  const ramaiahCapTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: ramaiahV1Id, patientId: ramaiahId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Capecitabine 1250mg/m² — twice daily (14 on / 7 off)',
    severity: 'HIGH', startDate: weeksAgo(1), endDate: daysAhead(42, 8), status: 'ACTIVE',
    instructions: 'Take with food within 30 minutes of a meal. Watch for hand-foot syndrome and diarrhoea.',
    taskData: { medicineName: 'Capecitabine', dosage: '1250mg/m²', frequency: 'Twice daily', timing: '08:00, 20:00' },
    schedule: { times: ['08:00'], intervalDays: 1 },
    createdAt: weeksAgo(1), updatedAt: weeksAgo(1),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: ramaiahV1Id, patientId: ramaiahId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'APPOINTMENT', title: 'Post-discharge wound check — surgical OPD',
    severity: 'MEDIUM', startDate: daysAhead(5, 10), endDate: null, status: 'ACTIVE',
    instructions: 'Surgical outpatient clinic, Dr. Ravi Prakash. Bring discharge summary.',
    taskData: { doctorName: 'Dr. Ravi Prakash', specialty: 'Surgical Oncology' },
    schedule: null, createdAt: weeksAgo(1), updatedAt: weeksAgo(1),
  });

  // ── Meena Kumari — v1 ACTIVE ──────────────────────────────────────────────────
  const meenaV1Result = await db.collection('careplanversions').insertOne({
    patientId: meenaId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(5), effectiveFrom: weeksAgo(5),
    publishedById: navigatorId, notes: 'Paclitaxel + Carboplatin q3w. Currently cycle 3 of 6.',
    sourceBatchId: null, createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });
  const meenaV1Id = meenaV1Result.insertedId;

  const meenaPacTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: meenaV1Id, patientId: meenaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Paclitaxel 175mg/m² — q3w infusion (cycle 3 of 6)',
    severity: 'HIGH', startDate: weeksAgo(5), endDate: daysAhead(63, 9), status: 'ACTIVE',
    instructions: 'Premedicate with dexamethasone 20mg IV, diphenhydramine 50mg IV, ranitidine 50mg IV before paclitaxel. 3h infusion.',
    taskData: { medicineName: 'Paclitaxel', dosage: '175mg/m²', frequency: 'Every 21 days', timing: 'Day care unit 09:00' },
    schedule: { times: ['09:00'], intervalDays: 1 },
    createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: meenaV1Id, patientId: meenaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Ondansetron 8mg — twice daily for 3 days post-chemo',
    severity: 'MEDIUM', startDate: weeksAgo(5), endDate: daysAhead(63, 8), status: 'ACTIVE',
    instructions: 'Anti-nausea regimen for 3 days following each Paclitaxel/Carboplatin infusion. Critical for adherence.',
    taskData: { medicineName: 'Ondansetron', dosage: '8mg', frequency: 'Twice daily, 3 days post-chemo', timing: '08:00, 20:00' },
    schedule: { times: ['08:00', '20:00'], intervalDays: 1 },
    createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: meenaV1Id, patientId: meenaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'CBC + CA-125 before each cycle',
    severity: 'HIGH', startDate: daysAhead(5, 9), endDate: null, status: 'ACTIVE',
    instructions: 'CA-125 tumour marker and CBC required before each cycle. Track trend.',
    taskData: { testName: 'CBC + CA-125', notes: 'Required before each q3w cycle', labName: 'City Cancer Center Pathology' },
    schedule: null, createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });

  // ── Suresh Babu — v1 ACTIVE (FOLFOX Stage IV gastric) ────────────────────────
  const sureshV1Result = await db.collection('careplanversions').insertOne({
    patientId: sureshId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(7), effectiveFrom: weeksAgo(7),
    publishedById: navigatorId, notes: 'FOLFOX regimen. Palliative intent — Stage IV gastric. Pain management critical.',
    sourceBatchId: null, createdAt: weeksAgo(7), updatedAt: weeksAgo(7),
  });
  const sureshV1Id = sureshV1Result.insertedId;

  const sureshOxalTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: sureshV1Id, patientId: sureshId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Oxaliplatin 85mg/m² + 5-FU 400mg/m² — biweekly FOLFOX',
    severity: 'HIGH', startDate: weeksAgo(7), endDate: daysAhead(56, 9), status: 'ACTIVE',
    instructions: 'Biweekly IV infusion. Monitor for peripheral neuropathy. Avoid cold exposure for 48h post-infusion.',
    taskData: { medicineName: 'Oxaliplatin + 5-FU (FOLFOX)', dosage: 'Oxaliplatin 85mg/m² + 5-FU 400mg/m²', frequency: 'Every 14 days', timing: 'Day care unit 09:00' },
    schedule: { times: ['09:00'], intervalDays: 1 },
    createdAt: weeksAgo(7), updatedAt: weeksAgo(7),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: sureshV1Id, patientId: sureshId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Tramadol 50mg — pain management, every 6h as needed',
    severity: 'HIGH', startDate: weeksAgo(7), endDate: daysAhead(90, 9), status: 'ACTIVE',
    instructions: 'Breakthrough pain management. Do NOT exceed 400mg/24h. Escalate to morphine if >3 doses/day needed.',
    taskData: { medicineName: 'Tramadol', dosage: '50mg', frequency: 'Every 6h PRN', timing: 'As needed' },
    schedule: { times: ['08:00', '14:00', '20:00', '02:00'], intervalDays: 1 },
    createdAt: weeksAgo(7), updatedAt: weeksAgo(7),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: sureshV1Id, patientId: sureshId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'CBC + CMP — before each biweekly cycle',
    severity: 'HIGH', startDate: daysAhead(3, 9), endDate: null, status: 'ACTIVE',
    instructions: 'Check counts and electrolytes. Delay cycle if ANC <1.5 or creatinine significantly elevated.',
    taskData: { testName: 'CBC + Comprehensive Metabolic Panel', frequency: 'Before each biweekly cycle', labName: 'City Cancer Center Pathology' },
    schedule: null, createdAt: weeksAgo(7), updatedAt: weeksAgo(7),
  });

  // ── Radha Bai — v1 ACTIVE (Stage III cervical concurrent chemo-RT) ────────────
  const radhaV1Result = await db.collection('careplanversions').insertOne({
    patientId: radhaId, versionNumber: 1, previousVersionId: null, status: 'ACTIVE',
    publishedAt: weeksAgo(5), effectiveFrom: weeksAgo(5),
    publishedById: navigatorId, notes: 'Concurrent Cisplatin + external beam radiotherapy. Ongoing.',
    sourceBatchId: null, createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });
  const radhaV1Id = radhaV1Result.insertedId;

  const radhaCisplatinTask = await db.collection('careplantasks').insertOne({
    carePlanVersionId: radhaV1Id, patientId: radhaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'MEDICATION', title: 'Cisplatin 40mg/m² — weekly concurrent with RT',
    severity: 'HIGH', startDate: weeksAgo(5), endDate: daysAhead(21, 9), status: 'ACTIVE',
    instructions: 'Weekly IV Cisplatin concurrent with external beam radiation. Pre-hydration 1L NS before + after. Audiometry before cycle 4.',
    taskData: { medicineName: 'Cisplatin', dosage: '40mg/m²', frequency: 'Weekly during radiotherapy', timing: 'Day care unit 09:00' },
    schedule: { times: ['09:00'], intervalDays: 1 },
    createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: radhaV1Id, patientId: radhaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'PET-CT scan — post-treatment response assessment',
    severity: 'HIGH', startDate: daysAhead(21, 9), endDate: null, status: 'ACTIVE',
    instructions: 'PET-CT to assess treatment response 6 weeks after completing chemo-RT. OVERDUE — patient missed scheduled scan.',
    taskData: { testName: 'PET-CT scan (whole body)', notes: 'Post-treatment response assessment — 6 weeks after RT completion', location: 'Nuclear Medicine, Memorial Hospital' },
    schedule: null, createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });
  await db.collection('careplantasks').insertOne({
    carePlanVersionId: radhaV1Id, patientId: radhaId,
    previousTaskId: null, sourceExtractedTaskId: null,
    type: 'LAB_TEST', title: 'SCC antigen + CBC — before each weekly cycle',
    severity: 'MEDIUM', startDate: weeksAgo(5), endDate: daysAhead(21, 8), status: 'ACTIVE',
    instructions: 'Squamous cell carcinoma antigen as tumour marker. CBC to ensure counts adequate for next Cisplatin dose.',
    taskData: { testName: 'SCC Antigen + CBC', frequency: 'Weekly', labName: 'City Cancer Center Pathology' },
    schedule: null, createdAt: weeksAgo(5), updatedAt: weeksAgo(5),
  });

  console.log('Care plans created.');

  // ── 11. Review Queue Batches + AI Extracted Tasks ─────────────────────────────

  // Ravi Kumar — PENDING (new chemo protocol, cycle 13)
  const raviBatchResult = await db.collection('reviewbatches').insertOne({
    patientId: raviId, documentId: raviDocResult.insertedId, navigatorId,
    status: 'PENDING', taskCount: 3, verifiedCount: 0, rejectedCount: 0,
    reviewedBy: null, reviewedAt: null,
    createdAt: daysAgo(2, 11), updatedAt: daysAgo(2, 11),
  });
  const raviBatchId = raviBatchResult.insertedId;
  await db.collection('aiextractedtasks').insertMany([
    {
      reviewBatchId: raviBatchId, patientId: raviId, documentId: raviDocResult.insertedId,
      taskType: 'MEDICATION', confidence: 0.93, reviewStatus: 'AI_GENERATED',
      sourceText: 'Cycle 13: Continue Capecitabine 500mg/m² PO BID x14 days with 7 day rest. Dose reduction to 75% if grade 2+ hand-foot syndrome persists.',
      extractedData: { medicineName: 'Capecitabine', dosage: '500mg/m² (75% dose reduction if HFS grade 2+)', frequency: 'Twice daily, 14 on / 7 off', notes: 'Cycle 13 — dose reduction clause' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(2, 11, 5), updatedAt: daysAgo(2, 11, 5),
    },
    {
      reviewBatchId: raviBatchId, patientId: raviId, documentId: raviDocResult.insertedId,
      taskType: 'LAB_TEST', confidence: 0.88, reviewStatus: 'AI_GENERATED',
      sourceText: 'CBC with differential 3 days prior to cycle 13. Hold cycle if ANC <1.5 × 10⁹/L or PLT <75 × 10⁹/L.',
      extractedData: { testName: 'CBC with differential', labName: 'City Cancer Center Pathology', notes: '3 days before cycle 13. Hold if ANC <1.5 or PLT <75' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(2, 11, 5), updatedAt: daysAgo(2, 11, 5),
    },
    {
      reviewBatchId: raviBatchId, patientId: raviId, documentId: raviDocResult.insertedId,
      taskType: 'APPOINTMENT', confidence: 0.71, reviewStatus: 'AI_GENERATED',
      sourceText: 'Oncology review 2 weeks after cycle 13 start. Patient to bring symptom diary and hand inspection.',
      extractedData: { specialty: 'Medical Oncology', doctorName: 'Dr. Anand Rao', notes: 'Review 2 weeks after cycle 13 — hand-foot inspection + symptom diary' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(2, 11, 5), updatedAt: daysAgo(2, 11, 5),
    },
  ]);

  // Sunita Devi — IN_REVIEW (bloodwork + Capecitabine protocol)
  const sunitaBatchResult = await db.collection('reviewbatches').insertOne({
    patientId: sunitaId, documentId: sunitaDocResult.insertedId, navigatorId,
    status: 'IN_REVIEW', taskCount: 3, verifiedCount: 1, rejectedCount: 0,
    reviewedBy: navigatorId, reviewedAt: daysAgo(1, 14),
    createdAt: at(7, 29), updatedAt: daysAgo(1, 14),
  });
  const sunitaBatchId = sunitaBatchResult.insertedId;
  await db.collection('aiextractedtasks').insertMany([
    {
      reviewBatchId: sunitaBatchId, patientId: sunitaId, documentId: sunitaDocResult.insertedId,
      taskType: 'MEDICATION', confidence: 0.91, reviewStatus: 'VERIFIED',
      sourceText: 'Commence Capecitabine 500mg/m² PO BID for cycles 5–8. 14 days on, 7 days off. Concurrent with hormone therapy.',
      extractedData: { medicineName: 'Capecitabine', dosage: '500mg/m²', frequency: 'Twice daily, 14 on / 7 off', duration: 'Cycles 5–8 (concurrent with Tamoxifen)' },
      navigatorEdits: null, reviewedBy: navigatorId, reviewedAt: daysAgo(1, 14),
      createdAt: at(7, 29), updatedAt: daysAgo(1, 14),
    },
    {
      reviewBatchId: sunitaBatchId, patientId: sunitaId, documentId: sunitaDocResult.insertedId,
      taskType: 'LAB_TEST', confidence: 0.87, reviewStatus: 'AI_GENERATED',
      sourceText: 'CBC with differential before each Capecitabine cycle (3 days prior). Schedule for 13 May, 3 June, 24 June, 15 July.',
      extractedData: { testName: 'CBC with differential', labName: 'City Cancer Center Pathology', scheduledDates: '13 May, 3 Jun, 24 Jun, 15 Jul', notes: '3 days before each cycle start' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: at(7, 29), updatedAt: at(7, 29),
    },
    {
      reviewBatchId: sunitaBatchId, patientId: sunitaId, documentId: sunitaDocResult.insertedId,
      taskType: 'APPOINTMENT', confidence: 0.68, reviewStatus: 'AI_GENERATED',
      sourceText: 'Review 4 weeks post cycle 5 with oncologist. Assess hormone therapy tolerance + chemo side effects.',
      extractedData: { specialty: 'Oncology', notes: 'Post-cycle 5 review — hormone therapy tolerance + chemo side effects combined assessment' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: at(7, 29), updatedAt: at(7, 29),
    },
  ]);

  // Krishnamurthy — PENDING (PET scan response + cycle 5 protocol)
  const krishBatchResult = await db.collection('reviewbatches').insertOne({
    patientId: krishId, documentId: krishDocResult.insertedId, navigatorId,
    status: 'PENDING', taskCount: 2, verifiedCount: 0, rejectedCount: 0,
    reviewedBy: null, reviewedAt: null,
    createdAt: daysAgo(1, 14), updatedAt: daysAgo(1, 14),
  });
  const krishBatchId = krishBatchResult.insertedId;
  await db.collection('aiextractedtasks').insertMany([
    {
      reviewBatchId: krishBatchId, patientId: krishId, documentId: krishDocResult.insertedId,
      taskType: 'LAB_TEST', confidence: 0.89, reviewStatus: 'AI_GENERATED',
      sourceText: 'Post cycle 5 PET-CT shows 40% reduction in mediastinal nodes. Continue current regimen. Repeat PET-CT after cycle 6.',
      extractedData: { testName: 'PET-CT scan (whole body)', notes: 'Response assessment after cycle 6 — 40% reduction seen at cycle 5', scheduledDate: '6 weeks after cycle 6 completion' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(1, 14, 5), updatedAt: daysAgo(1, 14, 5),
    },
    {
      reviewBatchId: krishBatchId, patientId: krishId, documentId: krishDocResult.insertedId,
      taskType: 'MEDICATION', confidence: 0.82, reviewStatus: 'AI_GENERATED',
      sourceText: 'Consider adding Pembrolizumab 200mg q3w if PD-L1 TPS >50% confirmed on rebiopsy. Pending molecular report.',
      extractedData: { medicineName: 'Pembrolizumab (pending PD-L1 result)', dosage: '200mg', frequency: 'Every 21 days', notes: 'Conditional addition — requires PD-L1 TPS >50% from rebiopsy' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: daysAgo(1, 14, 5), updatedAt: daysAgo(1, 14, 5),
    },
  ]);

  // Ramaiah — IN_REVIEW (discharge summary, 1 verified)
  const ramaiahBatchResult = await db.collection('reviewbatches').insertOne({
    patientId: ramaiahId, documentId: ramaiahDocResult.insertedId, navigatorId,
    status: 'IN_REVIEW', taskCount: 2, verifiedCount: 1, rejectedCount: 0,
    reviewedBy: navigatorId, reviewedAt: daysAgo(1, 14),
    createdAt: at(8, 51), updatedAt: daysAgo(1, 14),
  });
  const ramaiahBatchId = ramaiahBatchResult.insertedId;
  await db.collection('aiextractedtasks').insertMany([
    {
      reviewBatchId: ramaiahBatchId, patientId: ramaiahId, documentId: ramaiahDocResult.insertedId,
      taskType: 'APPOINTMENT', confidence: 0.95, reviewStatus: 'VERIFIED',
      sourceText: 'Post-operative wound check in 7–10 days. Review at surgical outpatient clinic with Dr. Ravi Prakash.',
      extractedData: { specialty: 'Surgical Oncology', doctorName: 'Dr. Ravi Prakash', notes: 'Post-discharge wound check, 7–10 days' },
      navigatorEdits: null, reviewedBy: navigatorId, reviewedAt: daysAgo(1, 14),
      createdAt: at(8, 51), updatedAt: daysAgo(1, 14),
    },
    {
      reviewBatchId: ramaiahBatchId, patientId: ramaiahId, documentId: ramaiahDocResult.insertedId,
      taskType: 'LAB_TEST', confidence: 0.82, reviewStatus: 'AI_GENERATED',
      sourceText: 'CT abdomen + pelvis at 6 weeks post-discharge to assess resection margins and regional lymph nodes.',
      extractedData: { testName: 'CT abdomen + pelvis', notes: '6 weeks post-discharge — resection margin + lymph node assessment' },
      navigatorEdits: null, reviewedBy: null, reviewedAt: null,
      createdAt: at(8, 51), updatedAt: at(8, 51),
    },
  ]);

  // Update documents with batch IDs
  await db.collection('document_metas').updateOne(
    { _id: raviDocResult.insertedId }, { $set: { reviewBatchId: raviBatchId } },
  );
  await db.collection('document_metas').updateOne(
    { _id: sunitaDocResult.insertedId }, { $set: { reviewBatchId: sunitaBatchId } },
  );
  await db.collection('document_metas').updateOne(
    { _id: krishDocResult.insertedId }, { $set: { reviewBatchId: krishBatchId } },
  );
  await db.collection('document_metas').updateOne(
    { _id: ramaiahDocResult.insertedId }, { $set: { reviewBatchId: ramaiahBatchId } },
  );

  // Update Sunita v2 DRAFT with batch source
  await db.collection('careplanversions').updateOne(
    { _id: sunitaV2Id }, { $set: { sourceBatchId: sunitaBatchId } },
  );
  console.log('Review batches + AI tasks created.');

  // ── 12. Update patients with active care plan version IDs ─────────────────────
  const cpUpdates: [mongoose.Types.ObjectId, mongoose.Types.ObjectId][] = [
    [padmaId, padmaV1Id], [vijayId, vijayV1Id], [anithaId, anithaV1Id],
    [raviId, raviV2Id], [sunitaId, sunitaV1Id], [krishId, krishV2Id],
    [ramaiahId, ramaiahV1Id], [meenaId, meenaV1Id], [sureshId, sureshV1Id], [radhaId, radhaV1Id],
  ];
  for (const [pid, vid] of cpUpdates) {
    await db.collection('users').updateOne({ _id: pid }, { $set: { activeCarePlanVersionId: vid } });
  }

  // ── 13. Reminder Events ───────────────────────────────────────────────────────

  // Padma Reddy — Carboplatin weekly, 100% adherence (4 past confirmed, 4 ahead)
  await insertReminders({
    patientId: padmaId, taskId: padmaCapTask.insertedId, versionId: padmaV1Id,
    taskType: 'MEDICATION', taskTitle: 'Carboplatin 300mg — weekly infusion',
    times: ['09:00'], historyDays: 28, missedDays: new Set(), futureDays: 28,
  });

  // Vijay Nair — Bicalutamide daily, 95% adherence (20 days, miss day 10)
  await insertReminders({
    patientId: vijayId, taskId: vijayMedTask.insertedId, versionId: vijayV1Id,
    taskType: 'MEDICATION', taskTitle: 'Bicalutamide 50mg — once daily',
    times: ['08:00'], historyDays: 20, missedDays: new Set([10]), futureDays: 7,
  });

  // Anitha Kumari — Levothyroxine daily, 96% adherence (25 days, miss day 13)
  await insertReminders({
    patientId: anithaId, taskId: anithaLevoTask.insertedId, versionId: anithaV1Id,
    taskType: 'MEDICATION', taskTitle: 'Levothyroxine 100mcg — once daily',
    times: ['07:00'], historyDays: 25, missedDays: new Set([13]), futureDays: 7,
  });

  // Ravi Kumar — Capecitabine twice daily, 80% adherence (10 days history)
  await insertReminders({
    patientId: raviId, taskId: raviCapTask.insertedId, versionId: raviV2Id,
    taskType: 'MEDICATION', taskTitle: 'Capecitabine 500mg — twice daily',
    times: ['08:00', '20:00'], historyDays: 10, missedDays: new Set([3, 9]), futureDays: 14,
  });

  // Sunita Devi — Tamoxifen daily, 62.5% adherence (8 days, miss days 2, 5, 7)
  await insertReminders({
    patientId: sunitaId, taskId: sunitaTamTask.insertedId, versionId: sunitaV1Id,
    taskType: 'MEDICATION', taskTitle: 'Tamoxifen 20mg — once daily',
    times: ['09:00'], historyDays: 8, missedDays: new Set([2, 5, 7]), futureDays: 7,
  });

  // Krishnamurthy — Dexamethasone daily (on-cycle days), 71% adherence
  await insertReminders({
    patientId: krishId, taskId: krishCarbTask.insertedId, versionId: krishV2Id,
    taskType: 'MEDICATION', taskTitle: 'Carboplatin+Pemetrexed+Bevacizumab — q3w infusion',
    times: ['09:00'], historyDays: 14, missedDays: new Set([3, 6, 10, 13]), futureDays: 7,
  });

  // Ramaiah G. — Capecitabine, 0% adherence (4 days, ALL missed)
  await insertReminders({
    patientId: ramaiahId, taskId: ramaiahCapTask.insertedId, versionId: ramaiahV1Id,
    taskType: 'MEDICATION', taskTitle: 'Capecitabine 1250mg/m² — twice daily',
    times: ['08:00'], historyDays: 4, missedDays: new Set([1, 2, 3, 4]), futureDays: 5,
  });

  // Meena Kumari — Ondansetron twice daily, 25% adherence (8 days: confirm days 1,4 only)
  await insertReminders({
    patientId: meenaId, taskId: meenaPacTask.insertedId, versionId: meenaV1Id,
    taskType: 'MEDICATION', taskTitle: 'Paclitaxel+Carboplatin — q3w infusion',
    times: ['08:00', '20:00'], historyDays: 8, missedDays: new Set([2, 3, 5, 6, 7, 8]), futureDays: 4,
  });

  // Suresh Babu — Tramadol, 50% adherence (6 days: miss every other)
  await insertReminders({
    patientId: sureshId, taskId: sureshOxalTask.insertedId, versionId: sureshV1Id,
    taskType: 'MEDICATION', taskTitle: 'Oxaliplatin+5-FU (FOLFOX) — biweekly',
    times: ['09:00'], historyDays: 6, missedDays: new Set([2, 4, 6]), futureDays: 5,
  });

  // Radha Bai — Cisplatin weekly, 40% adherence (10 days: confirm days 1, 3, 5, 8)
  await insertReminders({
    patientId: radhaId, taskId: radhaCisplatinTask.insertedId, versionId: radhaV1Id,
    taskType: 'MEDICATION', taskTitle: 'Cisplatin 40mg/m² — weekly concurrent with RT',
    times: ['09:00'], historyDays: 10, missedDays: new Set([2, 4, 6, 7, 9, 10]), futureDays: 5,
  });

  console.log('Reminder events created.');

  // ── 14. Escalations ───────────────────────────────────────────────────────────

  // Ramaiah: 4 consecutive misses → escalated to navigator (MISSED_REMINDERS)
  await db.collection('escalationevents').insertOne({
    patientId: ramaiahId, navigatorId,
    trigger: 'MISSED_REMINDERS', triggerEntityId: null, triggerEntityType: 'ReminderEvent',
    level: 'NAVIGATOR', status: 'ESCALATED_TO_NAVIGATOR',
    missedCount: 4,
    caregiverNotifiedAt: daysAgo(2, 10), navigatorNotifiedAt: daysAgo(1, 6),
    resolvedAt: null, resolvedById: null, resolutionNote: '',
    createdAt: daysAgo(2, 10), updatedAt: daysAgo(1, 6),
  });

  // Sunita: 3 misses in 48h → OPEN at caregiver level (Rajesh notified)
  await db.collection('escalationevents').insertOne({
    patientId: sunitaId, navigatorId,
    trigger: 'MISSED_REMINDERS', triggerEntityId: null, triggerEntityType: 'ReminderEvent',
    level: 'CAREGIVER', status: 'OPEN',
    missedCount: 3,
    caregiverNotifiedAt: daysAgo(1, 10), navigatorNotifiedAt: null,
    resolvedAt: null, resolvedById: null, resolutionNote: '',
    createdAt: daysAgo(1, 10), updatedAt: daysAgo(1, 10),
  });

  // Meena: 6 misses → OPEN at caregiver level (son Pradeep notified)
  await db.collection('escalationevents').insertOne({
    patientId: meenaId, navigatorId,
    trigger: 'MISSED_REMINDERS', triggerEntityId: null, triggerEntityType: 'ReminderEvent',
    level: 'CAREGIVER', status: 'OPEN',
    missedCount: 6,
    caregiverNotifiedAt: daysAgo(2, 8), navigatorNotifiedAt: null,
    resolvedAt: null, resolvedById: null, resolutionNote: '',
    createdAt: daysAgo(2, 8), updatedAt: daysAgo(2, 8),
  });

  // Suresh: HIGH fever + pain → escalated to navigator (HIGH_ALERT)
  await db.collection('escalationevents').insertOne({
    patientId: sureshId, navigatorId,
    trigger: 'HIGH_ALERT', triggerEntityId: null, triggerEntityType: 'Alert',
    level: 'NAVIGATOR', status: 'ESCALATED_TO_NAVIGATOR',
    missedCount: 0,
    caregiverNotifiedAt: daysAgo(0, 8), navigatorNotifiedAt: daysAgo(0, 8),
    resolvedAt: null, resolvedById: null, resolutionNote: '',
    createdAt: daysAgo(0, 8), updatedAt: daysAgo(0, 8),
  });

  // Radha: missed PET scan → escalated to navigator (MISSED_APPOINTMENT)
  await db.collection('escalationevents').insertOne({
    patientId: radhaId, navigatorId,
    trigger: 'MISSED_APPOINTMENT', triggerEntityId: null, triggerEntityType: 'Alert',
    level: 'NAVIGATOR', status: 'ESCALATED_TO_NAVIGATOR',
    missedCount: 0,
    caregiverNotifiedAt: daysAgo(3, 9), navigatorNotifiedAt: daysAgo(3, 9),
    resolvedAt: null, resolvedById: null, resolutionNote: '',
    createdAt: daysAgo(3, 9), updatedAt: daysAgo(3, 9),
  });

  console.log('Escalations created.');

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`\nNavigator:  navigator@gmail.com / navigator123  (OTP: 1111111111 → 1234)`);
  console.log(`Admin:      ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
  console.log('\n── STABLE PATIENTS (≥95% adherence) ─────────────────────────');
  console.log('  1. Padma Reddy     HA-2026-100001  Stage I Cervical    Carboplatin weekly    100%');
  console.log('  2. Vijay Nair      HA-2026-100002  Stage II Prostate   Bicalutamide daily     95%');
  console.log('  3. Anitha Kumari   HA-2026-100003  Stage II Thyroid    Levothyroxine daily    96%');
  console.log('\n── ACTIVE ONCOLOGY (chemo cycles, evolving plans) ────────────');
  console.log('  4. Ravi Kumar      HA-2026-100004  Stage II Oral       Capecitabine x2/day    80%  v2 ACTIVE + review batch PENDING');
  console.log('  5. Sunita Devi     HA-2026-100005  Stage III Breast    Tamoxifen daily        63%  v1 ACTIVE + v2 DRAFT, batch IN_REVIEW, caregiver escalation OPEN');
  console.log('  6. Krishnamurthy   HA-2026-100006  Stage III Lung      Carbo+Pem+Bev q3w     71%  v2 ACTIVE (Bev added cycle 4) + review batch PENDING');
  console.log('\n── NON-ADHERENT (caregiver escalations triggered) ────────────');
  console.log('  7. Ramaiah G.      HA-2026-100007  Stage II Colorectal Capecitabine           0%   ESCALATED_TO_NAVIGATOR (4 missed)');
  console.log('  8. Meena Kumari    HA-2026-100008  Stage III Ovarian   Paclitaxel q3w        25%   OPEN CAREGIVER (6 missed)');
  console.log('\n── HIGH-RISK (navigator escalations, critical alerts) ────────');
  console.log('  9. Suresh Babu     HA-2026-100009  Stage IV Gastric    FOLFOX biweekly       50%   ESCALATED_TO_NAVIGATOR (HIGH_ALERT: fever 39.2°C + pain 8/10)');
  console.log(' 10. Radha Bai       HA-2026-100010  Stage III Cervical  Cisplatin weekly      40%   ESCALATED_TO_NAVIGATOR (MISSED_APPOINTMENT: PET scan overdue)');
  console.log('\n── REVIEW QUEUE ───────────────────────────────────────────────');
  console.log('  Ravi Kumar       — PENDING  (3 AI tasks: Capecitabine dose reduction + CBC + review)');
  console.log('  Sunita Devi      — IN_REVIEW (3 AI tasks: 1 verified Capecitabine + 2 pending)');
  console.log('  Krishnamurthy    — PENDING  (2 AI tasks: PET-CT follow-up + Pembrolizumab add)');
  console.log('  Ramaiah G.       — IN_REVIEW (2 AI tasks: 1 verified wound check + CT pending)');
  console.log('══════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
