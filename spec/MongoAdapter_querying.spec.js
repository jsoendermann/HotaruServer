/* global jasmine, describe, it, expect, beforeAll */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import toBeAnAlphanumericString from 'to-be-an-alphanumeric-string';
import toHaveHappenedRecently from './matchers/toHaveHappenedRecently';
import setUpMongoAdapterWithEmptyTestDb from './helpers/setUpMongoAdapterWithEmptyTestDb';

// TODO createdAt, updatedAt

describe('MongoAdapter (querying)', function () {
  const Query = require('../lib/Query').default;

  const TEST_OBJECTS = [
    { _id: 'obj1', a: 1, b: 'test', c: [1, 2], __internal: 'bla' },
    { _id: 'obj2', a: 1, b: 'testtest', c: [2] },
    { _id: 'obj3', a: 2, b: 'test test', c: [2] },
    { _id: 'obj4', a: 2, b: 'TEST' },
    { _id: 'obj5', a: 3 },
    { _id: 'obj6', a: 20 },
    { _id: 'obj7', a: 10 },
    { _id: 'obj8', a: 21 },
  ];

  beforeAll(async function () {
    this.adapter = await setUpMongoAdapterWithEmptyTestDb();

    jasmine.addMatchers({ toHaveHappenedRecently, toBeAnAlphanumericString });

    await this.adapter.saveAll('TestClass', TEST_OBJECTS);
  });

  it('should find all objects in a collection', async function () {
    const query = new Query('TestClass');
    const allObjects = await this.adapter.find(query);

    expect(allObjects.length).toEqual(TEST_OBJECTS.length);
  });

  it('should handle equalTo', async function () {
    const query = new Query('TestClass');
    query.equalTo('a', 3);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(1);
  });

  it('should handle lessThan', async function () {
    const query = new Query('TestClass');
    query.lessThan('a', 3);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(4);
  });

  it('should handle lessThanOrEqual', async function () {
    const query = new Query('TestClass');
    query.lessThanOrEqual('a', 3);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(5);
  });

  it('should handle greaterThan', async function () {
    const query = new Query('TestClass');
    query.greaterThan('a', 3);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(3);
  });

  it('should handle greaterThanOrEqual', async function () {
    const query = new Query('TestClass');
    query.greaterThanOrEqual('a', 3);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(4);
  });

  it('should handle containedIn', async function () {
    const query = new Query('TestClass');
    query.containedIn('a', [1, 2]);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(4);
  });

  it('should handle notContainedIn', async function () {
    const query = new Query('TestClass');
    query.notContainedIn('a', [1, 2, 3]);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(3);
  });

  it('should handle mod', async function () {
    const query = new Query('TestClass');
    query.mod('a', 2, 0);
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(4);
  });

  it('should handle regex', async function () {
    const query = new Query('TestClass');
    query.regex('b', '^test$', 'i');
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(2);
  });

  it('should handle where', async function () {
    const query = new Query('TestClass');
    query.where('this.c && this.c.indexOf(this.a) !== -1');
    const objects = await this.adapter.find(query);

    expect(objects.length).toEqual(2);
  });

  it('should sort objects ascending', async function () {
    const query = new Query('TestClass');
    query.greaterThanOrEqual('a', 10);
    query.lessThan('a', 21);
    query.ascending('a');
    const objects = await this.adapter.find(query);

    expect(objects.map(o => o._id)).toEqual(['obj7', 'obj6']);
  });

  it('should sort objects descending', async function () {
    const query = new Query('TestClass');
    query.greaterThanOrEqual('a', 10);
    query.lessThan('a', 22);
    query.descending('a');
    const objects = await this.adapter.find(query);

    expect(objects.map(o => o._id)).toEqual(['obj8', 'obj6', 'obj7']);
  });

  it('should handle limit', async function () {
    const query = new Query('TestClass');
    query.greaterThanOrEqual('a', 10);
    query.ascending('a');
    query.limit(2);
    const objects = await this.adapter.find(query);

    expect(objects.map(o => o._id)).toEqual(['obj7', 'obj6']);
  });

  it('should handle limit and skip', async function () {
    const query = new Query('TestClass');
    query.greaterThanOrEqual('a', 3);
    query.ascending('a');
    query.limit(2);
    query.skip(1);
    const objects = await this.adapter.find(query);

    expect(objects.map(o => o._id)).toEqual(['obj7', 'obj6']);
  });

  it('should find just one object with first', async function () {
    const query = new Query('TestClass');
    query.descending('a');
    const object = await this.adapter.first(query);

    expect(object._id).toEqual('obj8');
  });

  it('should strip internal fields', async function () {
    const query = new Query('TestClass');
    query.equalTo('_id', 'obj1');
    const obj = await this.adapter.first(query);

    expect(obj.__internal).toBeUndefined();
  });

  it('should not strip internal fields when using _internalFind', async function () {
    const query = new Query('TestClass');
    query.equalTo('_id', 'obj1');
    const obj = await this.adapter._internalFirst(query);

    expect(obj.__internal).not.toBeUndefined();
  });

  it('should return null when calling first with a query that returns no result', async function () {
    const query = new Query('TestClass');
    query.equalTo('a', 99);
    const object = await this.adapter.first(query);

    expect(object).toBeNull();
  });
});
