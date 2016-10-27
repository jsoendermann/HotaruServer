/* global jasmine, describe, it, expect, beforeEach, beforeAll */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import catchError from 'jasmine-es6/helpers/catch_error';

import toHaveHappenedRecently from './matchers/toHaveHappenedRecently';
import toBeAnAlphanumericString from './matchers/toBeAnAlphanumericString';

install();


const DB_URI = 'mongodb://localhost:27017/hotaru_test';

// TODO createdAt, updatedAt

describe('MongoAdapter', function () {
  const MongoAdapter = require('../lib/MongoAdapter').default;

  beforeEach(async function () {
    this.adapter = new MongoAdapter({ uri: DB_URI, schema: null });
    const db = await this.adapter._getDb();
    await db.dropDatabase();

    jasmine.addMatchers({ toHaveHappenedRecently, toBeAnAlphanumericString });
  });

  it('should save users', async function () {
    const user = { _id: 'testuser', __isGuest: true, createdAt: new Date(), updatedAt: new Date() };

    const error = await catchError(this.adapter.saveUser(user));
    expect(error).toMatch(/Can not create new objet in UPDATE_ONLY savingMode/);

    const savedUser1 = await this.adapter.saveObject(
      '_User',
      user,
      { savingMode: MongoAdapter.SavingMode.CREATE_ONLY, _allowSavingToInternalClasses: true }
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

  it('should allow saving to internal classes if _allowSavingToInternalClasses is true', async function () {
    const object = await this.adapter.saveObject('_Arst', { a: 1 }, { _allowSavingToInternalClasses: true });

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

  it('should accept custom _ids generate fresh ones for other objects', async function () {
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

  it('should create users', async function () {
    const user = await this.adapter._createUser('email@example.com', 'password');

    const _User = await this.adapter._getUserCollection();
    const allExistingUsers = await _User.find().toArray();

    expect(allExistingUsers.length).toEqual(1);

    expect(allExistingUsers[0]._id).toEqual(user._id);
    expect(allExistingUsers[0].email).toEqual('email@example.com');
    expect(allExistingUsers[0].__hashedPassword).toBeTruthy();
    expect(allExistingUsers[0].__isGuest).toBeFalsy();
    expect(allExistingUsers[0].createdAt.getTime() / 10000).toBeCloseTo(new Date().getTime() / 10000, 1);
    expect(allExistingUsers[0].updatedAt.getTime() / 10000).toBeCloseTo(new Date().getTime() / 10000, 1);
  });

  it('should validate email addresses before creating users', async function () {
    const error = await catchError(this.adapter._createUser('_$%^', 'password'));

    expect(error).toMatch(/Invalid email address/);
  });

  it('should validate passwords before creating users', async function () {
    const error = await catchError(this.adapter._createUser('email@example.com', ''));

    expect(error).toMatch(/Invalid password/);
  });

  it("should ensure another user with the same email address doesn't already exist", async function () {
    const EMAIL = 'email@example.com';
    const PASSWORD = 'password';

    await this.adapter._createUser(EMAIL, PASSWORD);
    const error = await catchError(this.adapter._createUser(EMAIL, PASSWORD));

    expect(error).toMatch(/User already exists/);
  });

  it('should create guest users', async function () {
    const guestUser = await this.adapter._createGuestUser();

    expect(guestUser._id).toBeTruthy();
    expect(guestUser.email).toBeNull();
    expect(guestUser.__hashedPassword).toBeNull();
    expect(guestUser.__isGuest).toBeTruthy();
    expect(guestUser.createdAt.getTime() / 10000).toBeCloseTo(new Date().getTime() / 10000, 1);
    expect(guestUser.updatedAt.getTime() / 10000).toBeCloseTo(new Date().getTime() / 10000, 1);
  });

  it('should create sessions', async function () {
    const user = await this.adapter._createGuestUser();
    const session = await this.adapter._createSession(user._id);

    expect(session._id).toMatch(/^[a-zA-Z0-9]{32}$/);
    expect(session.userId).toEqual(user._id);
    expect(session.createdAt.getTime() / 10000).toBeCloseTo(new Date().getTime() / 10000, 1);
    expect(session.expiresAt.getTime() / 10000).toBeCloseTo(new Date('Jan 1, 2039').getTime() / 10000, 1);
  });

  it('should get users with sessions', async function () {
    const user = await this.adapter._createGuestUser();
    const session = await this.adapter._createSession(user._id);

    const userWithSession = await this.adapter._getUserWithSessionId(session._id);

    expect(userWithSession._id).toEqual(user._id);
  });

  it('should handle non-existing sessions', async function () {
    const error = await catchError(this.adapter._getUserWithSessionId('哈罗你好吗？'));

    expect(error).toMatch(/Session not found/);
  });

  it("should handle sessions of users who don't exist", async function () {
    const session = await this.adapter._createSession('衷心感谢');
    const error = await catchError(this.adapter._getUserWithSessionId(session._id));

    expect(error).toMatch(/Session not found/);
  });

  it('should end sessions', async function () {
    const user = await this.adapter._createGuestUser();
    const session = await this.adapter._createSession(user._id);

    const _Session = await this.adapter._getSessionCollection();

    const allExistingSessions1 = await _Session.find().toArray();
    expect(allExistingSessions1.length).toEqual(1);

    await this.adapter._endSession(session._id);

    const allExistingSessions2 = await _Session.find().toArray();
    expect(allExistingSessions2.length).toEqual(0);
  });

  it('should find existing users by email', async function () {
    const EMAIL = 'email@example.com';

    const user = await this.adapter._createUser(EMAIL, 'password');
    const foundUser = await this.adapter._getUserWithEmail(EMAIL);

    expect(user._id).toEqual(foundUser._id);
  });

  it('should not find non-existing users by email', async function () {
    const error = await catchError(this.adapter._getUserWithEmail('email@example.com'));
    expect(error).toMatch(/No user with given email address/);
  });
});

describe('MongoAdapter (querying)', function () {
  const MongoAdapter = require('../lib/MongoAdapter').default;
  const Query = require('../lib/Query').default;

  const TEST_OBJECTS = [
    { _id: 'obj1', a: 1, b: 'test', c: [1, 2] },
    { _id: 'obj2', a: 1, b: 'testtest', c: [2] },
    { _id: 'obj3', a: 2, b: 'test test', c: [2] },
    { _id: 'obj4', a: 2, b: 'TEST' },
    { _id: 'obj5', a: 3 },
    { _id: 'obj6', a: 20 },
    { _id: 'obj7', a: 10 },
    { _id: 'obj8', a: 21 },
  ];

  beforeAll(async function () {
    this.adapter = new MongoAdapter({ uri: DB_URI, schema: null });
    const db = await this.adapter._getDb();
    await db.dropDatabase();

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
    await this.adapter._createGuestUser();
    const user = await this.adapter.first(new Query('_User'));

    expect(user._id).toBeAnAlphanumericString(15);
    expect(user.email).toBeNull();
    expect(user.__hashedPassword).toBeUndefined();
  });
});
