import { Router } from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import _ from 'lodash';
import defaultdict from 'defaultdict-proxy';
import Semaphore from 'semaphore-async-await';
import HotaruError from './HotaruError';
import { freshId, isAlphanum, validateEmail, stripInternalFields, SavingMode } from './utils';
import Query from './Query';

const PACKAGE_VERSION = require(`${__dirname}/../package.json`).version; // eslint-disable-line

const locks = defaultdict(() => new Semaphore(1));

// This should eventually be a decorator
function routeHandlerWrapper(routeHandler, debug = false) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      const result = await routeHandler(req);
      res.send(JSON.stringify({ status: 'ok', result, serverVersion: PACKAGE_VERSION }));
    } catch (error) {
      let response;
      if (error instanceof HotaruError) {
        response = { status: 'error', code: error.code, message: error.message };
      } else if (debug) {
        response = { status: 'error', code: -1, message: error.toString() };
      } else {
        response = { status: 'error', code: -1, message: 'Internal error' };
      }
      res.send(JSON.stringify(response));
    }
  };
}

function loggedInRouteHandlerWrapper(loggedInRouteHandler, dbAdapter) {
  return async (req) => {
    const { sessionId } = req.body;

    if (sessionId === undefined) {
      throw new HotaruError(HotaruError.NOT_LOGGED_IN);
    }

    const sessionQuery = new Query('_Session');
    sessionQuery.equalTo('_id', sessionId);
    const session = await dbAdapter._internalFirst(sessionQuery);

    if (session === null) {
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    await locks[session.userId].wait();
    try {
      const userQuery = new Query('_User');
      userQuery.equalTo('_id', session.userId);
      const internalUser = await dbAdapter._internalFirst(userQuery);

      if (internalUser === null) {
        // This is weird, the user must've gotten deleted after the session was created.
        // The best course of action here is probably to delete the session and pretend
        // it didn't exist
        await dbAdapter._internalDeleteObject('_Session', session);
        throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
      }
      
      // await is necessary because loggedInRouteHandler has to finish executing before
      // we release the lock.
      return await loggedInRouteHandler(req, sessionId, internalUser);
    } finally {
      locks[session.userId].signal();
    }
  };
}

export default class HotaruServer {

  constructor({ dbAdapter, cloudFunctions, validatePassword = p => p.length > 6, debug = false }) {
    this.dbAdapter = dbAdapter;
    this.cloudFunctions = cloudFunctions;
    this.validatePassword = validatePassword;
    this.debug = debug;

    _.bindAll(this, ['logInAsGuest', 'signUp', 'convertGuestUser', 'logIn', 'logOut', 'runCloudFunction']);
  }

  static createServer({ dbAdapter, cloudFunctions, debug = false }) {
    const server = new HotaruServer({ dbAdapter, cloudFunctions, debug });
    const router = Router({ caseSensitive: true }); // eslint-disable-line new-cap
    router.use(bodyParser.json());

    router.post('/_logInAsGuest', (req, res) =>
      routeHandlerWrapper(server.logInAsGuest, server.debug)(req, res));
    router.post('/_signUp', (req, res) =>
      routeHandlerWrapper(server.signUp, server.debug)(req, res));
    router.post('/_convertGuestUser', (req, res) =>
      routeHandlerWrapper(loggedInRouteHandlerWrapper(server.convertGuestUser, dbAdapter), server.debug)(req, res));
    router.post('/_logIn', (req, res) =>
      routeHandlerWrapper(server.logIn, server.debug)(req, res));
    router.post('/_logOut', (req, res) =>
      routeHandlerWrapper(loggedInRouteHandlerWrapper(server.logOut, dbAdapter), server.debug)(req, res));

    cloudFunctions.forEach(({ name }) => {
      if (!isAlphanum(name)) {
        throw new HotaruError(HotaruError.CLOUD_FUNCTION_NAMES_MUST_BE_ALPHANUMERIC);
      }

      router.post(`/${name}`, (req, res) => routeHandlerWrapper(loggedInRouteHandlerWrapper(server.runCloudFunction(name), dbAdapter), server.debug)(req, res));
    });

    return router;
  }

  static _freshUserObject(email, hashedPassword) {
    const now = new Date();
    return {
      email,
      __hashedPassword: hashedPassword,
      createdAt: now,
      updatedAt: now,
    };
  }

  async logInAsGuest(_req) {
    const newInternalUser = await this.dbAdapter._internalSaveObject(
      '_User',
      HotaruServer._freshUserObject(null, null, true),
      { savingMode: SavingMode.CREATE_ONLY }
    );

    // TODO If creating the session fails, we should delete the user and return an error
    const newSession = await this.dbAdapter._internalSaveObject(
      '_Session',
      {
        _id: freshId(32),
        userId: newInternalUser._id,
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
        // TODO installationId
      },
      { savingMode: SavingMode.CREATE_ONLY }
    );

    const newUser = stripInternalFields(newInternalUser);
    return { sessionId: newSession._id, user: newUser };
  }

  async signUp(req) {
    const { email, password } = req.body;

    if (!validateEmail(email)) {
      throw new HotaruError(HotaruError.INVALID_EMAIL_ADDRESS);
    }

    if (!this.validatePassword(password)) {
      throw new HotaruError(HotaruError.INVALID_PASSWORD);
    }

    const existingUserQuery = new Query('_User');
    existingUserQuery.equalTo('email', email);
    const existingUser = await this.dbAdapter.first(existingUserQuery);

    if (existingUser !== null) {
      throw new HotaruError(HotaruError.USER_ALREADY_EXISTS);
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const newInternalUser = await this.dbAdapter._internalSaveObject(
      '_User',
      HotaruServer._freshUserObject(email, hashedPassword, false),
      { savingMode: SavingMode.CREATE_ONLY }
    );


    // TODO If creating the session fails, we should delete the user and return an error
    const newSession = await this.dbAdapter._internalSaveObject(
      '_Session',
      {
        _id: freshId(32),
        userId: newInternalUser._id,
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
        // TODO installationId
      },
      { savingMode: SavingMode.CREATE_ONLY }
    );

    const newUser = stripInternalFields(newInternalUser);
    return { sessionId: newSession._id, user: newUser };
  }

  async convertGuestUser(req, sessionId, internalUser) {
    const { email, password } = req.body;

    if (internalUser.email !== null) {
      throw new HotaruError(HotaruError.CAN_NOT_CONVERT_NON_GUEST_USER);
    }

    internalUser.email = email;
    // TODO extract password management into a separate module
    internalUser.__hashedPassword = bcrypt.hashSync(password, 10);

    const savedInternalUser = await this.dbAdapter.saveUser(internalUser);
    const savedUser = stripInternalFields(savedInternalUser);

    return { user: savedUser };
  }

  async logIn(req) {
    const { email, password } = req.body;

    const userQuery = new Query('_User');
    userQuery.equalTo('email', email);
    const internalUser = await this.dbAdapter._internalFirst(userQuery);

    if (internalUser === null) {
      throw new HotaruError(HotaruError.NO_USER_WITH_GIVEN_EMAIL_ADDRESS);
    }

    if (!bcrypt.compareSync(password, internalUser.__hashedPassword)) {
      throw new HotaruError(HotaruError.INCORRECT_PASSWORD);
    }

    const newSession = await this.dbAdapter._internalSaveObject(
      '_Session',
      {
        _id: freshId(32),
        userId: internalUser._id,
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
        // TODO installationId
      },
      { savingMode: SavingMode.CREATE_ONLY }
    );
    const user = stripInternalFields(internalUser);

    return { sessionId: newSession._id, user };
  }

  async logOut(req, sessionId) {
    const sessionQuery = new Query('_Session');
    sessionQuery.equalTo('_id', sessionId);
    const session = await this.dbAdapter._internalFirst(sessionQuery);

    if (session === null) {
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    const success = await this.dbAdapter._internalDeleteObject('_Session', session);

    if (!success) {
      throw new HotaruError(HotaruError.LOGOUT_FAILED);
    }
    return {};
  }

  runCloudFunction(cloudFunctionName) {
    return async (req, sessionId, internalUser) => {
      const { params, installationDetails } = req.body;

      const user = stripInternalFields(internalUser);

      const cloudFunction = this.cloudFunctions.find(({ name }) => cloudFunctionName === name).func;
      return await cloudFunction(this.dbAdapter, user, params, installationDetails);
    };
  }
}
