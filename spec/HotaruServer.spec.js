/* global jasmine, describe, it, expect, beforeAll */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import axios from 'axios';
import install from 'jasmine-es6';
import toBeAnAlphanumericString from 'to-be-an-alphanumeric-string';

import toHaveHappenedRecently from './matchers/toHaveHappenedRecently';
import wait from './helpers/wait';

const PACKAGE_VERSION = require(`${__dirname}/../package.json`).version; // eslint-disable-line

install();


const DB_URI = 'mongodb://localhost:27017/hotaru_test';
const PORT = 3030;


describe('HotaruServer', function () {
  const express = require('express');
  const HotaruServer = require('../lib/HotaruServer').default;
  const MongoAdapter = require('../lib/MongoAdapter').default;
  const Query = require('../lib/Query').default;
  const HotaruError = require('../lib/HotaruError').default;

  beforeAll(async function () {
    jasmine.addMatchers({ toBeAnAlphanumericString, toHaveHappenedRecently });

    const app = express();

    this.dbAdapter = new MongoAdapter({
      uri: DB_URI,
      schema: null,
    });

    const db = await this.dbAdapter._getDb();
    await db.dropDatabase();

    const server = HotaruServer.createServer({
      dbAdapter: this.dbAdapter,
      cloudFunctions: [
        {
          name: 'returnParams',
          func: async (_dbAdapter, user, params, _installationDetails) => params,
        },
        {
          name: 'createObjects',
          func: async (dbAdapter_, _user, _params, _installationDetails) => {
            const objects = [
              { _id: 'obj1', a: 1 },
              { _id: 'obj2', a: 2 },
              { _id: 'obj3', a: 3 },
              { a: 4 },
            ];

            await dbAdapter_.saveAll('TestClass', objects);
          },
        },
        {
          name: 'returnObjects',
          func: async (dbAdapter_, _user, _params, _installationDetails) => {
            const query = new Query('TestClass');
            return await dbAdapter_.find(query);
          },
        },
        {
          name: 'deleteSomeObjects',
          func: async (dbAdapter_, _user, _params, _installationDetails) => {
            const query = new Query('TestClass');
            query.lessThanOrEqual('a', 2);
            const objects = await dbAdapter_.find(query);

            return await dbAdapter_.deleteAll('TestClass', objects);
          },
        },
        {
          name: 'synchronizationTest',
          func: async (dbAdapter_, user, _params, _installationDetails) => {
            user.set('syncVar', user.get('syncVar') || 0);

            const tmp = user.get('syncVar');
            await wait(500);
            user.set('syncVar', tmp + 1);

            await dbAdapter_.saveUser(user);
            return user.get('syncVar');
          },
        },
        {
          name: 'setVar',
          func: async (dbAdapter_, user, params, _installationDetails) => {
            const { field, value } = params;
            user.set(field, value);
            await dbAdapter_.saveUser(user);
          },
        },
      ],
      debug: true,
    });

    app.use('/api', server);
    app.listen(PORT);
  });

  it('should log in guest users', async function () {
    const response = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});

    expect(response.data.status).toEqual('ok');
    expect(response.data.result.sessionId).toBeTruthy();
    expect(response.data.result.user._id).toBeAnAlphanumericString(15);
    expect(response.data.result.user.__hashedPassword).toBeUndefined();
    expect(new Date(response.data.result.user.createdAt)).toHaveHappenedRecently();
    expect(new Date(response.data.result.user.updatedAt)).toHaveHappenedRecently();
    expect(response.data.serverVersion).toEqual(PACKAGE_VERSION);
  });

  it('should sign up new users', async function () {
    const response = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email1@example.com',
      password: 'password',
    });

    expect(response.data.status).toEqual('ok');
    expect(response.data.result.sessionId).toBeTruthy();
    expect(response.data.result.user._id).toBeAnAlphanumericString(15);
    expect(response.data.result.user.__hashedPassword).toBeUndefined();
  });

  it('should not sign up new users with invalid email addresses', async function () {
    const response = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'arst',
      password: 'password',
    });

    expect(response.data.status).toEqual('error');
    expect(response.data.code).toEqual(HotaruError.INVALID_EMAIL_ADDRESS);
  });

  it('should not sign up new users with invalid passwords', async function () {
    const response = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email1.5@example.com',
      password: 'short',
    });

    expect(response.data.status).toEqual('error');
    expect(response.data.code).toEqual(HotaruError.INVALID_PASSWORD);
  });

  it('should not let users sign up with existing email addresses', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email1.6@example.com',
      password: 'password',
    });

    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email1.6@example.com',
      password: 'password',
    });

    expect(response2.data.status).toEqual('error');
    expect(response2.data.code).toEqual(HotaruError.USER_ALREADY_EXISTS);
  });

  it('should convert guest users', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});

    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/_convertGuestUser`, {
      email: 'email2@example.com',
      password: 'password',
      sessionId: response1.data.result.sessionId,
    });

    expect(response2.data.status).toEqual('ok');
    expect(response2.data.result.user._id).toBeAnAlphanumericString(15);
    expect(response2.data.result.user.__hashedPassword).toBeUndefined();
  });

  it('should not handle missing sessionIds', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});

    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/_convertGuestUser`, {
      email: 'email2@example.com',
      password: 'password',
      // sessionId: response1.data.result.sessionId,
    });

    expect(response2.data.status).toEqual('error');
    expect(response2.data.code).toEqual(HotaruError.NOT_LOGGED_IN);
  });

  it('should handle non-existing sessionIds', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});

    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/_convertGuestUser`, {
      email: 'email2@example.com',
      password: 'password',
      sessionId: 'I DONT EXIST',
    });

    expect(response2.data.status).toEqual('error');
    expect(response2.data.code).toEqual(HotaruError.SESSION_NOT_FOUND);
  });

  it('should handle sessionIds of non-existing users', async function () {
    await this.dbAdapter._internalSaveObject(
      '_Session',
      {
        _id: 'SESSION_ID',
        userId: 'I DO NOT EXIST',
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
      }
    );

    const response = await axios.post(`http://localhost:${PORT}/api/_logOut`, {
      sessionId: 'SESSION_ID',
    });

    expect(response.data.status).toEqual('error');
    expect(response.data.code).toEqual(HotaruError.SESSION_NOT_FOUND);
  });

  it('should log out and log in users', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email3@example.com',
      password: 'password',
    });

    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/_logOut`, {
      sessionId: response1.data.result.sessionId,
    });

    expect(response2.data.status).toEqual('ok');

    const response3 = await axios.post(`http://localhost:${PORT}/api/_logIn`, {
      email: 'email3@example.com',
      password: 'password',
    });

    expect(response3.data.status).toEqual('ok');
    expect(response3.data.result.sessionId).toBeTruthy();
    expect(response3.data.result.user._id).toBeAnAlphanumericString(15);
    expect(response3.data.result.user.__hashedPassword).toBeUndefined();
  });

  it('should not log in users with non-existing email addresses', async function () {
    const response = await axios.post(`http://localhost:${PORT}/api/_logIn`, {
      email: 'IDONTEXIST@example.com',
      password: 'password',
    });

    expect(response.data.status).toEqual('error');
    expect(response.data.code).toEqual(HotaruError.NO_USER_WITH_GIVEN_EMAIL_ADDRESS);
  });

  it('should not log in users with wrong passwords', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email3.5@example.com',
      password: 'password',
    });

    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/_logOut`, {
      sessionId: response1.data.result.sessionId,
    });

    expect(response2.data.status).toEqual('ok');

    const response3 = await axios.post(`http://localhost:${PORT}/api/_logIn`, {
      email: 'email3.5@example.com',
      password: 'WRONGPASSWORD',
    });

    expect(response3.data.status).toEqual('error');
    expect(response3.data.code).toEqual(HotaruError.INCORRECT_PASSWORD);
  });

  it('should process parameters when calling cloud functions', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});
    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/returnParams`, {
      sessionId: response1.data.result.sessionId,
      params: { a: 1 },
    });

    expect(response2.data.result).toEqual({ a: 1 });
  });

  it('should create, return and delete objects in cloud functions', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});
    expect(response1.data.status).toEqual('ok');

    const response2 = await axios.post(`http://localhost:${PORT}/api/createObjects`, {
      sessionId: response1.data.result.sessionId,
    });
    expect(response2.data.status).toEqual('ok');

    const response3 = await axios.post(`http://localhost:${PORT}/api/returnObjects`, {
      sessionId: response1.data.result.sessionId,
    });
    expect(response3.data.result.map(o => o.a)).toEqual([1, 2, 3, 4]);

    const response4 = await axios.post(`http://localhost:${PORT}/api/deleteSomeObjects`, {
      sessionId: response1.data.result.sessionId,
    });
    expect(response4.data.status).toEqual('ok');

    const response5 = await axios.post(`http://localhost:${PORT}/api/returnObjects`, {
      sessionId: response1.data.result.sessionId,
    });
    expect(response5.data.result.map(o => o.a)).toEqual([3, 4]);
  });

  it('should synchronize user-specific endpoints', async function () {
    const response = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});
    expect(response.data.status).toEqual('ok');

    const req1 = axios.post(`http://localhost:${PORT}/api/synchronizationTest`, {
      sessionId: response.data.result.sessionId,
    });
    const req2 = await axios.post(`http://localhost:${PORT}/api/synchronizationTest`, {
      sessionId: response.data.result.sessionId,
    });

    const response1 = await req1;
    const response2 = await req2;

    expect(response1.data.status).toEqual('ok');
    expect(response2.data.status).toEqual('ok');

    expect(Math.max(response1.data.result, response2.data.result)).toEqual(2);
  });

  it('should synchronize users', async () => {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_logInAsGuest`, {});
    expect(response1.data.status).toEqual('ok');
    const sessionId = response1.data.result.sessionId;

    const response2 = await axios.post(`http://localhost:${PORT}/api/setVar`, { sessionId, params: { field: 'a', value: 2 } });
    expect(response2.data.status).toEqual('ok');
    const response3 = await axios.post(`http://localhost:${PORT}/api/setVar`, { sessionId, params: { field: 'b', value: 'foo' } });
    expect(response3.data.status).toEqual('ok');

    const clientChangelog = [
      {
        _id: 'id1',
        date: new Date(),
        type: 'increment',
        field: 'a',
        value: 1,
      },
      {
        _id: 'id2',
        date: new Date(),
        type: 'set',
        field: 'b',
        value: 'bla',
      },
      {
        _id: 'id3',
        date: new Date(),
        type: 'increment',
        field: 'a',
        value: 1,
      },
    ];

    const response4 = await axios.post(`http://localhost:${PORT}/api/_synchronizeUser`, { sessionId, clientChangelog });
    expect(response4.data.status).toEqual('ok');
    const newUser = response4.data.result.user;
    expect(newUser.a).toEqual(4);
    expect(newUser.b).toEqual('bla');
    const processedChanges1 = response4.data.result.processedChanges;
    expect(processedChanges1).toEqual(['id1', 'id2', 'id3']);

    const response5 = await axios.post(`http://localhost:${PORT}/api/setVar`, { sessionId, params: { field: 'a', value: -1 } });
    expect(response5.data.status).toEqual('ok');

    const response6 = await axios.post(`http://localhost:${PORT}/api/_synchronizeUser`, { sessionId, clientChangelog: [] });
    expect(response6.data.status).toEqual('ok');
    const newestUser = response6.data.result.user;
    expect(newestUser.a).toEqual(-1);
    expect(newestUser.b).toEqual('bla');
    const processedChanges2 = response6.data.result.processedChanges;
    expect(processedChanges2).toEqual([]);
  });
});
