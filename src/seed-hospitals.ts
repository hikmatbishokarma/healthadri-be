import 'dotenv/config';
import * as mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri';

const HOSPITALS = [
  {
    name: 'Basavatarakam Indo American Cancer Hospital',
    city: 'Hyderabad',
    address: 'Road No. 10, Banjara Hills, Hyderabad',
    type: 'trust',
    tags: ['Oral Cancer', 'Chemo', 'Radiation', 'Surgery'],
    acceptsAarogyasri: true,
    offersPalliative: true,
  },
  {
    name: 'MNJ Institute of Oncology',
    city: 'Hyderabad',
    address: 'Red Hills, Lakdikapul, Hyderabad',
    type: 'government',
    tags: ['Head & Neck', 'Radiation', 'Chemo'],
    acceptsAarogyasri: true,
    offersPalliative: true,
  },
  {
    name: 'Yashoda Hospitals',
    city: 'Secunderabad',
    address: 'Alexander Road, Secunderabad',
    type: 'private',
    tags: ['Surgery', 'Chemo', 'Radiation'],
    acceptsAarogyasri: false,
    offersPalliative: false,
  },
  {
    name: 'AIIMS Bibinagar',
    city: 'Hyderabad',
    address: 'Bibinagar, Yadadri-Bhuvanagiri',
    type: 'government',
    tags: ['Oncology', 'Surgery', 'Chemo'],
    acceptsAarogyasri: true,
    offersPalliative: false,
  },
  {
    name: 'Apollo Cancer Centre',
    city: 'Hyderabad',
    address: 'Jubilee Hills, Hyderabad',
    type: 'private',
    tags: ['Chemo', 'Radiation', 'Bone Marrow Transplant'],
    acceptsAarogyasri: false,
    offersPalliative: true,
  },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  const col = mongoose.connection.db.collection('hospitals');

  for (const h of HOSPITALS) {
    const existing = await col.findOne({ name: h.name });
    if (existing) {
      await col.updateOne({ _id: existing._id }, { $set: h });
      console.log(`Updated: ${h.name}`);
    } else {
      await col.insertOne(h);
      console.log(`Inserted: ${h.name}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone — hospitals collection synced.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
