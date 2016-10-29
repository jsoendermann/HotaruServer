import MongoAdapter from '../../lib/MongoAdapter';

const TEST_DB_URI = 'mongodb://localhost:27017/hotaru_test';

export default async function setUpMongoAdapterWithEmptyTestDb() {
  const adapter = new MongoAdapter({ uri: TEST_DB_URI, schema: null });
  const db = await adapter._getDb();
  await db.dropDatabase();
  return adapter;
}
