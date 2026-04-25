import 'dotenv/config';
import * as mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';

function daysFromNow(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const patient = await db.collection('users').findOne({ role: 'patient' });
  if (!patient) {
    console.error('No patient found. Run `npm run seed` first.');
    process.exit(1);
  }
  console.log(`Seeding appointments for patient: ${patient.name} (${patient._id})`);

  const appts = [
    {
      patientId: patient._id,
      type: 'chemo',
      title: 'Chemotherapy — Session 3',
      doctor: 'Dr. Anand Rao',
      location: 'Basavatarakam',
      scheduledAt: daysFromNow(3, 10, 0),
      status: 'scheduled',
      notes: 'Carry Aadhar + Aarogyasri card.',
      createdByUserId: null,
    },
    {
      patientId: patient._id,
      type: 'counselling',
      title: 'Counselling Session',
      doctor: 'Dr. Meera K. · Onco-Psychologist',
      location: 'Online Video Call',
      scheduledAt: daysFromNow(6, 16, 0),
      status: 'scheduled',
      notes: '',
      createdByUserId: null,
    },
    {
      patientId: patient._id,
      type: 'lab',
      title: 'Lab Tests — CBC & LFT',
      doctor: '',
      location: 'Vijaya Diagnostics · NABL · Himayatnagar',
      scheduledAt: daysFromNow(10, 8, 0),
      status: 'scheduled',
      notes: 'Fasting required.',
      createdByUserId: null,
    },
    {
      patientId: patient._id,
      type: 'chemo',
      title: 'Chemotherapy — Session 2',
      doctor: 'Dr. Anand Rao',
      location: 'Basavatarakam',
      scheduledAt: daysFromNow(-7, 10, 0),
      status: 'completed',
      notes: '',
      createdByUserId: null,
    },
  ];

  const col = db.collection('appointments');
  for (const a of appts) {
    const existing = await col.findOne({
      patientId: a.patientId,
      title: a.title,
      scheduledAt: a.scheduledAt,
    });
    if (existing) {
      console.log(`Skipped (exists): ${a.title}`);
    } else {
      await col.insertOne({ ...a, createdAt: new Date(), updatedAt: new Date() });
      console.log(`Inserted: ${a.title}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone — appointments seeded.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
