/* global jasmine, describe, it, expect, beforeEach */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import catchError from 'jasmine-es6/helpers/catch_error';

import toHaveHappenedRecently from './matchers/toHaveHappenedRecently';
import toBeAnAlphanumericString from './matchers/toBeAnAlphanumericString';
import setUpMongoAdapterWithEmptyTestDb from './helpers/setUpMongoAdapterWithEmptyTestDb';

install();

describe('MongoAdapter (saving)', function () {
  const MongoAdapter = require('../lib/MongoAdapter').default;
  const Query = require('../lib/Query').default;

  beforeEach(async function () {
    this.adapter = await setUpMongoAdapterWithEmptyTestDb();

    jasmine.addMatchers({ toHaveHappenedRecently, toBeAnAlphanumericString });
  });

  it('should save users', async function () {
    const user = { _id: 'testuser', createdAt: new Date(), updatedAt: new Date() };

    const error = await catchError(this.adapter.saveUser(user));
    expect(error).toMatch(/Can not create new objet in UPDATE_ONLY savingMode/);

    const savedUser1 = await this.adapter._internalSaveObject(
      '_User',
      user,
      { savingMode: MongoAdapter.SavingMode.CREATE_ONLY }
    );

    savedUser1.a = 'b';

    const savedUser2 = await this.adapter.saveUser(savedUser1);

    expect(savedUser2._id).toEqual('testuser');
    expect(savedUser2.a).toEqual('b');
  });

  it('should save single objects', async function () {
    const object = { a: 1, b: 2 };
    const savedObject = await this.adapter.saveObject('TestClass', object);

    expect(object !== savedObject).toBeTruthy();
    expect(savedObject._id).toBeAnAlphanumericString(15);
    expect(savedObject.a).toEqual(1);
    expect(savedObject.b).toEqual(2);
    expect(savedObject.createdAt).toHaveHappenedRecently();
    expect(savedObject.updatedAt).toHaveHappenedRecently();
  });

  it('should save multiple objects', async function () {
    const objects = [{ a: 1, b: 2 }, { a: 1, b: 3 }];
    const savedObjects = await this.adapter.saveAll('TestClass', objects);

    const [firstObject, secondObject] = savedObjects;

    expect(firstObject._id).toBeAnAlphanumericString(15);
    expect(secondObject._id).toBeAnAlphanumericString(15);
  });

  it('should not accept invalid saving modes', async function () {
    const object = { a: 1 };

    const e1 = await catchError(this.adapter.saveObject('ClassName', object, { savingMode: null }));
    const e2 = await catchError(this.adapter.saveObject('ClassName', object, { savingMode: Symbol('asrt') }));
    const e3 = await catchError(this.adapter.saveObject('ClassName', object, { savingMode: 1 }));

    [e1, e2, e3].forEach(e => expect(e).toMatch(/Unknown saving mode/));
  });

  it('should protect internal classes', async function () {
    const error = await catchError(this.adapter.saveObject('_Arst', { a: 1 }));

    expect(error).toMatch(/Invalid class name/);
  });

  it('should allow saving to internal classes with _internalSaveObject', async function () {
    const object = await this.adapter._internalSaveObject('_Arst', { a: 1 });

    expect(object._id).toBeAnAlphanumericString(15);
  });

  it('should not create new objects in UPDATE_ONLY savingMode', async function () {
    const object = { a: 1 };

    const error = await catchError(this.adapter.saveObject('TestClass', object, { savingMode: MongoAdapter.SavingMode.UPDATE_ONLY }));
    expect(error).toMatch(/Can not create new objet in UPDATE_ONLY savingMode/);
  });

  it('should not save two objects with the same _id', async function () {
    const objects = [{ _id: 'id1', foo: 'bar' }, { _id: 'id1', abc: 'xyz' }];

    const error = await catchError(this.adapter.saveAll('TestClass', objects));
    expect(error).toMatch(/Can not save two objects with the same _id/);
  });

  it('should not accept objects without id in UPDATE_ONLY savingMode', async function () {
    const error = await catchError(this.adapter.saveAll('TestClass', [{ a: 1 }], { savingMode: MongoAdapter.SavingMode.UPDATE_ONLY }));
    expect(error).toMatch(/Can not create new objet in UPDATE_ONLY savingMode/);
  });

  it('should accept custom _ids and generate fresh ones for other objects', async function () {
    const objects = [{ _id: 'bla', a: 1 }, { a: 2 }];

    const [o1, o2] = await this.adapter.saveAll('TestClass', objects, { savingMode: MongoAdapter.SavingMode.CREATE_ONLY });

    if (o1._id === 'bla') {
      expect(o2._id).toBeAnAlphanumericString(15);
    } else {
      expect(o1._id).toBeAnAlphanumericString(15);
      expect(o2._id).toEqual('bla');
    }
  });

  it('should not overwrite existing objects in CREATE_ONLY savingMode', async function () {
    const obj = { _id: 'testid', a: 1 };
    await this.adapter.saveObject('TestClass', obj);
    const error = await catchError(this.adapter.saveObject('TestClass', obj, { savingMode: MongoAdapter.SavingMode.CREATE_ONLY }));
    expect(error).toMatch(/Can not overwrite object in CREATE_ONLY savingMode/);
  });

  it('should not create new objects in UPDATE_ONLY savingMode', async function () {
    const error = await catchError(this.adapter.saveObject('TestClass', { a: 1 }, { savingMode: MongoAdapter.SavingMode.UPDATE_ONLY }));
    expect(error).toMatch(/Can not create new objet in UPDATE_ONLY savingMode/);
  });

  it('should preserve internal fields when saving', async function () {
    const obj = { _id: 'id', __internalField: 42, a: 1 };
    await this.adapter.saveObject('TestClass', obj);

    const sameObj = { _id: 'id', a: 2 };
    await this.adapter.saveObject('TestClass', sameObj);

    const query = new Query('TestClass');
    query.equalTo('_id', 'id');
    const fetchedObject = await this.adapter._internalFirst(query);

    expect(fetchedObject.__internalField).toEqual(42);
    expect(fetchedObject.a).toEqual(2);
  });

  it('should not reveal internal fields when saving', async function () {
    const obj = { _id: 'id', __internalField: 42, a: 1 };
    const savedObject = await this.adapter.saveObject('TestClass', obj);
    expect(savedObject.__internalField).toBeUndefined();
  });

  it('should not reveal internal fields when saving users', async function () {
    const user = { __bla: true, createdAt: new Date(), updatedAt: new Date() };
    const savedUser1 = await this.adapter._internalSaveObject(
      '_User',
      user,
      { savingMode: MongoAdapter.SavingMode.CREATE_ONLY }
    );

    savedUser1.a = 1;

    const savedUser2 = await this.adapter.saveUser(savedUser1);
    expect(savedUser2.__bla).toBeUndefined();
  });

  it('should not strip internal fields when saving with an _internal method', async function () {
    const obj = { _id: 'id', __internalField: 42, a: 1 };
    const savedObject = await this.adapter._internalSaveObject('TestClass', obj);
    expect(savedObject.__internalField).toEqual(42);
  });
});