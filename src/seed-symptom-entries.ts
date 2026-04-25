import 'dotenv/config';
import * as mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';

// Realistic 7-day pattern: starts moderate, peaks Thu-Fri (post-chemo), recovers
const PATTERN: Record<string, number[]> = {
  // index 0 = 7 days ago, index 6 = today (will be skipped — today is from real check-in)
  'Pain Level': [3, 4, 5, 6, 7, 5, 4],
  Fatigue:     [4, 5, 5, 7, 8, 7, 5],
  Nausea:      [2, 2, 3, 4, 5, 3, 2],
  Appetite:    [6, 5, 5, 4, 3, 4, 5],
  Fever:       [0, 0, 1, 2, 1, 0, 0],
};

function dateNDaysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 30, 0, 0);
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
  console.log(`Seeding 7 days of entries for patient: ${patient.name} (${patient._id})`);

  const symptoms = await db.collection('symptoms').find({}).toArray();
  if (symptoms.length === 0) {
    console.error('No symptoms found. Run `npm run seed:symptoms` first.');
    process.exit(1);
  }

  const entries = db.collection('symptomentries');

  // Insert 6 entries (6 days ago through 1 day ago). Today's entry is the user's own check-in.
  for (let dayOffset = 6; dayOffset >= 1; dayOffset--) {
    const createdAt = dateNDaysAgo(dayOffset);
    const patternIdx = 6 - dayOffset; // 0..5

    const exists = await entries.findOne({
      patientId: patient._id,
      createdAt: {
        $gte: new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()),
        $lt:  new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate() + 1),
      },
    });
    if (exists) {
      console.log(`Skipped (already have entry for ${createdAt.toDateString()})`);
      continue;
    }

    const responses = symptoms
      .filter((s) => PATTERN[s.name] !== undefined)
      .map((s) => ({
        symptomId: s._id,
        name: s.name,
        value: PATTERN[s.name][patternIdx] ?? 0,
      }));

    await entries.insertOne({
      patientId: patient._id,
      responses,
      createdAt,
      updatedAt: createdAt,
    });
    console.log(`Inserted entry for ${createdAt.toDateString()} (max ${Math.max(...responses.map((r) => r.value))}/10)`);
  }

  await mongoose.disconnect();
  console.log('\nDone — past symptom entries seeded.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
