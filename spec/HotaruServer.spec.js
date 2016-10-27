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
      cloudFunctions: [],
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
});
