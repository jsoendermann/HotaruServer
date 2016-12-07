import { MongoAdapter } from '../../lib/';

const TEST_DB_URI = 'mongodb://localhost:27017/hotaru_test';

export default async function setUpMongoAdapterWithEmptyTestDb() {
  const adapter = new MongoAdapter({ uri: TEST_DB_URI });
  const db = await adapter.getDb();
  await db.dropDatabase();
  return adapter;
}
