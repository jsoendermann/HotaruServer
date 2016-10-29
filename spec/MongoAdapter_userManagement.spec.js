/* global jasmine, describe, it, expect, beforeEach */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import catchError from 'jasmine-es6/helpers/catch_error';

import toHaveHappenedRecently from './matchers/toHaveHappenedRecently';
import toBeAnAlphanumericString from './matchers/toBeAnAlphanumericString';
import setUpMongoAdapterWithEmptyTestDb from './helpers/setUpMongoAdapterWithEmptyTestDb';

install();


describe('MongoAdapter (user management)', function () {
  beforeEach(async function () {
    this.adapter = await setUpMongoAdapterWithEmptyTestDb();

    jasmine.addMatchers({ toHaveHappenedRecently, toBeAnAlphanumericString });
  });

  it('should create users', async function () {
    const user = await this.adapter._createUser('email@example.com', 'password');

    const _User = await this.adapter._getUserCollection();
    const allExistingUsers = await _User.find().toArray();

    expect(allExistingUsers.length).toEqual(1);

    expect(allExistingUsers[0]._id).toEqual(user._id);
    expect(allExistingUsers[0].email).toEqual('email@example.com');
    expect(allExistingUsers[0].__hashedPassword).toBeTruthy();
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
