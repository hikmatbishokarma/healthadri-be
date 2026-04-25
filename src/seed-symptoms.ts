import 'dotenv/config';
import * as mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';

const SYMPTOMS = [
  { name: 'Pain',    type: 'scale', min: 0, max: 10, threshold: 6 },
  { name: 'Fatigue', type: 'scale', min: 0, max: 10, threshold: 7 },
  { name: 'Nausea',  type: 'scale', min: 0, max: 10, threshold: 6 },
  { name: 'Fever',   type: 'scale', min: 0, max: 10, threshold: 5 },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  const col = mongoose.connection.db.collection('symptoms');

  // Normalise older names: "Pain Level" -> "Pain"
  const oldPainLevel = await col.findOne({ name: 'Pain Level' });
  if (oldPainLevel) {
    await col.updateOne({ _id: oldPainLevel._id }, { $set: { name: 'Pain' } });
    console.log('Renamed "Pain Level" -> "Pain"');
  }

  // Remove Appetite — not in the current spec (Fever, Pain, Nausea, Fatigue only)
  const appetite = await col.findOne({ name: 'Appetite' });
  if (appetite) {
    await col.deleteOne({ _id: appetite._id });
    console.log('Removed "Appetite" (not in current spec)');
  }

  for (const s of SYMPTOMS) {
    const existing = await col.findOne({ name: s.name });
    if (existing) {
      await col.updateOne({ _id: existing._id }, { $set: s });
      console.log(`Updated: ${s.name}`);
    } else {
      await col.insertOne(s);
      console.log(`Inserted: ${s.name}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone — symptoms collection synced (Pain, Fatigue, Nausea, Fever).');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
