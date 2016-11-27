/* global describe, it, expect, beforeEach */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import setUpMongoAdapterWithEmptyTestDb from './helpers/setUpMongoAdapterWithEmptyTestDb';

describe('MongoAdapter (deletion)', function () {
  const Query = require('../lib/db/Query').default;

  beforeEach(async function () {
    this.adapter = await setUpMongoAdapterWithEmptyTestDb();
  });

  it('should delete single objects', async function () {
    await this.adapter.saveAll('TestClass', [{ a: 1 }, { a: 1 }]);

    const query = new Query('TestClass');
    const existingObjects1 = await this.adapter.find(query);
    expect(existingObjects1.length).toEqual(2);

    await this.adapter.deleteObject('TestClass', existingObjects1[0]);

    const existingObjects2 = await this.adapter.find(query);
    expect(existingObjects2.length).toEqual(1);
  });

  it('should delete multiple objects', async function () {
    await this.adapter.saveAll('TestClass', [{ a: 1 }, { a: 1 }, { a: 1 }]);

    const query = new Query('TestClass');
    const existingObjects1 = await this.adapter.find(query);
    expect(existingObjects1.length).toEqual(3);

    await this.adapter.deleteAll('TestClass', existingObjects1.slice(0, 2));

    const existingObjects2 = await this.adapter.find(query);
    expect(existingObjects2.length).toEqual(1);
  });
});
