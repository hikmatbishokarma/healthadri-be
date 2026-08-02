import 'dotenv/config';
import * as mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';

// Optional override so this doesn't always land on "whichever patient is
// first" — pass a phone to target a specific seeded demo patient, e.g.:
//   PATIENT_PHONE=1313131313 npx ts-node src/seed-appointments.ts
const PATIENT_PHONE = process.env.PATIENT_PHONE;

function daysFromNow(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const patient = await db.collection('users').findOne(
    PATIENT_PHONE ? { role: 'patient', phone: PATIENT_PHONE } : { role: 'patient' },
  );
  if (!patient) {
    console.error(
      PATIENT_PHONE
        ? `No patient found with phone ${PATIENT_PHONE}. Run \`npm run seed\` first.`
        : 'No patient found. Run `npm run seed` first.',
    );
    process.exit(1);
  }
  console.log(`Seeding tasks (Next Up) for patient: ${patient.name} (${patient._id})`);

  // Next Up on the patient dashboard reads GET /tasks?status=active, backed by
  // the `tasks` collection (type: 'visit' | 'test') — not the legacy
  // `appointments` collection, which nothing in the mobile app calls anymore.
  const tasks = [
    {
      patientId: patient._id,
      type: 'visit',
      title: 'Chemotherapy — Session 3, Basavatarakam',
      date: daysFromNow(3, 10, 0),
      status: 'active',
      sourceDocumentId: null,
    },
    {
      patientId: patient._id,
      type: 'test',
      title: 'Lab Tests — CBC & LFT (fasting required)',
      date: daysFromNow(10, 8, 0),
      status: 'active',
      sourceDocumentId: null,
    },
  ];

  const col = db.collection('tasks');
  for (const t of tasks) {
    const existing = await col.findOne({
      patientId: t.patientId,
      title: t.title,
      date: t.date,
    });
    if (existing) {
      console.log(`Skipped (exists): ${t.title}`);
    } else {
      await col.insertOne({ ...t, createdAt: new Date(), updatedAt: new Date() });
      console.log(`Inserted: ${t.title}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone — tasks seeded.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
