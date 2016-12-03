/* global jasmine, describe, it, expect, beforeEach */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import { HotaruUser, UserDataStore } from 'hotaru';
import catchError from 'jasmine-es6/helpers/catch_error';
import toBeAnAlphanumericString from 'to-be-an-alphanumeric-string';
import { MongoAdapter } from '../lib/db/adapters/MongoAdapter';

import toHaveHappenedRecently from './matchers/toHaveHappenedRecently';

install();

const TEST_DB_URI = 'mongodb://localhost:27017/hotaru_test';

const adapterWithSchema = async (schema) => {
  const adapter = new MongoAdapter({
    uri: TEST_DB_URI,
    schema,
  });
  const db = await adapter.getDb();
  await db.dropDatabase();
  return adapter;
};

describe('MongoAdapter (schema)', function () {
  const { Query } = require('../lib/db/Query');
  const { SavingMode } = require('../lib/db/adapters/MongoAdapter');

  beforeEach(async function () {
    jasmine.addMatchers({ toHaveHappenedRecently, toBeAnAlphanumericString });
  });

  it('should verify numbers', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'intField',
            type: 'int',
          },
          {
            fieldName: 'floatField',
            type: 'float',
          },
        ],
      },
    ]);


    await dbAdapter.saveObject('TestClass', { intField: 1 });
    const error = await catchError(dbAdapter.saveObject('TestClass', { intField: 1.1 }));
    expect(error).toMatch(/Schema conformance error \(Value 1\.1 of field intField does not conform to type int\)/);
    await dbAdapter.saveObject('TestClass', { floatField: 1.1 });
    await dbAdapter.saveObject('TestClass', { floatField: 1 });
  });

  it('should verify strings', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'stringField',
            type: 'string',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { stringField: 'haluo' });
    const error = await catchError(dbAdapter.saveObject('TestClass', { stringField: 1.1 }));
    expect(error).toMatch(/Schema conformance error/);
  });

  it('should verify bools', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'booleanField',
            type: 'boolean',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { booleanField: true });
    const error = await catchError(dbAdapter.saveObject('TestClass', { booleanField: 'true' }));
    expect(error).toMatch(/Schema conformance error/);
  });


  it('should verify arrays', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'arrayField',
            type: 'array',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { arrayField: [true, 1] });
    const error = await catchError(dbAdapter.saveObject('TestClass', { arrayField: { a: 1 } }));
    expect(error).toMatch(/Schema conformance error/);
  });

  it('should verify dates', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'dateField',
            type: 'date',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { dateField: new Date() });
    const error = await catchError(dbAdapter.saveObject('TestClass', { dateField: 'Sat Dec 03 2016 12:42:43 GMT+0100 (CET)' }));
    expect(error).toMatch(/Schema conformance error/);
  });

  it('should verify objects', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'objectField',
            type: 'object',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { objectField: {} });
    const error1 = await catchError(dbAdapter.saveObject('TestClass', { objectField: [] }));
    expect(error1).toMatch(/Schema conformance error/);
    const error2 = await catchError(dbAdapter.saveObject('TestClass', { objectField: new Date() }));
    expect(error2).toMatch(/Schema conformance error/);
  });

  it('should create a default ClassDescriptor for _User', async function () {
    const dbAdapter = await adapterWithSchema([]);

    const userData = { _id: 'testuser', createdAt: new Date(), updatedAt: new Date() };
    const savedUserData1 = await dbAdapter.internalSaveObject(
      '_User',
      userData,
      { savingMode: SavingMode.CreateOnly }
    );

    const user = new HotaruUser(new UserDataStore(savedUserData1));

    const savedUser = await dbAdapter.saveUser(user);

    savedUser.set('a', 1);

    const error = await catchError(dbAdapter.saveUser(savedUser));

    expect(error).toMatch(/Field not in schema: a/);
  });

  it('should not verify anything if no schema is set', async function () {
    const dbAdapter = await adapterWithSchema(null);
    dbAdapter.saveObject('BlaClass', { a: 1 });

    const userData = { _id: 'testuser', b: 2, createdAt: new Date(), updatedAt: new Date() };
    const savedUserData1 = await dbAdapter.internalSaveObject(
      '_User',
      userData,
      { savingMode: SavingMode.CreateOnly }
    );

    const user = new HotaruUser(new UserDataStore(savedUserData1));
    await dbAdapter.saveUser(user);
  });

  it('should reject classes that arent in the schema', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'dateField',
            type: 'date',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { dateField: new Date() });
    const error = await catchError(dbAdapter.saveObject('NonExistingClass', { dateField: new Date() }));
    expect(error).toMatch(/Class not in schema/);
  });

  it('should ignore internal fields', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'dateField',
            type: 'date',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { dateField: new Date(), __internal: 'haluo' });
  });

  it('should throw an error when the field name is not in the schema', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'dateField',
            type: 'date',
          },
        ],
      },
    ]);

    const error = await catchError(dbAdapter.saveObject('TestClass', { dateFieldWRONG: new Date() }));
    expect(error).toMatch(/Field not in schema/);
  });

  it('should accept null and undefined only when the field is nullable', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'nullableField',
            type: 'string',
            nullable: true,
          },
          {
            fieldName: 'nonNullableField',
            type: 'string',
            nullable: false,
          },
          {
            fieldName: 'nullableByDefaultField',
            type: 'string',
          },
        ],
      },
    ]);

    await dbAdapter.saveObject('TestClass', { nullableField: null, nonNullableField: 'arst' });
    await dbAdapter.saveObject('TestClass', { nonNullableField: 'arst' });
    const error1 = await catchError(dbAdapter.saveObject('TestClass', { }));
    expect(error1).toMatch(/is undefined but is not marked as nullable/);
    const error2 = await catchError(dbAdapter.saveObject('TestClass', { nonNullableField: null }));
    expect(error2).toMatch(/is null but is not marked as nullable/);
  });

  it('should typecheck nullable fields', async function () {
    const dbAdapter = await adapterWithSchema([
      {
        className: 'TestClass',
        fieldDescriptors: [
          {
            fieldName: 'nullableField',
            type: 'string',
            nullable: true,
          },
        ],
      },
    ]);

    const error1 = await catchError(dbAdapter.saveObject('TestClass', { nullableField: 1 }));
    expect(error1).toMatch(/does not conform to type/);
  });
});
