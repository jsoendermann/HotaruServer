/* global describe, it, expect, beforeAll */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import axios from 'axios';
import install from 'jasmine-es6';

install();


const DB_URI = 'mongodb://localhost:27017/hotaru_test';
const PORT = 3030;

describe('HotaruServer', function () {
  const express = require('express');
  const HotaruServer = require('../lib/HotaruServer').default;
  const MongoAdapter = require('../lib/MongoAdapter').default;
  const Query = require('../lib/Query').default;

  beforeAll(async function () {
    const app = express();

    const dbAdapter = new MongoAdapter({
      uri: DB_URI,
      schema: null,
    });

    const db = await dbAdapter._getDb();
    await db.dropDatabase();

    const server = HotaruServer.createServer({
      dbAdapter,
      cloudFunctions: [
        {
          name: 'returnParams',
          func: async function (dbAdapter, user, params, installationDetails) {
            return params;
          },
        },
        {
          name: 'returnUserEmailButNotPassword',
          func: async function (dbAdapter, user, params, installationDetails) {
            return {
              email: user.email,
              password: user.__hashedPassword,
            };
          },
        },

        {
          name: 'createObjects',
          func: async function (dbAdapter, user, params, installationDetails) {
            const objects = [
              { _id: 'obj1', a: 1 },
              { _id: 'obj2', a: 2 },
              { _id: 'obj3', a: 3 },
              { a: 4 },
            ];

            await dbAdapter.saveAll('TestClass', objects);
          },
        },
        {
          name: 'returnObjects',
          func: async function (dbAdapter, user, params, installationDetails) {
            const query = new Query('TestClass');
            return await dbAdapter.find(query);
          },
        },
        {
          name: 'deleteSomeObjects',
          func: async function (dbAdapter, user, params, installationDetails) {
            const query = new Query('TestClass');
            query.lessThanOrEqual('a', 2);
            const objects = await dbAdapter.find(query);

            return await dbAdapter.deleteAll('TestClass', objects);
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
  });

  it('should sign up new users', async function () {
    const response = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email1@example.com',
      password: 'password',
    });

    expect(response.data.status).toEqual('ok');
    expect(response.data.result.sessionId).toBeTruthy();
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

  it('should find the user when calling cloud functions', async function () {
    const response1 = await axios.post(`http://localhost:${PORT}/api/_signUp`, {
      email: 'email4@example.com',
      password: 'password',
    });

    const response2 = await axios.post(`http://localhost:${PORT}/api/returnUserEmailButNotPassword`, {
      sessionId: response1.data.result.sessionId,
      params: {},
    });

    expect(response2.data.result).toEqual({ email: 'email4@example.com' });
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
});
