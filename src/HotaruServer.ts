import { Router } from 'express';
import { json } from 'body-parser';
import { hashSync, compareSync } from 'bcryptjs';
import * as _ from 'lodash';
import { isAlphanumeric, isEmail } from 'validator';
import defaultdict from 'defaultdict-proxy';
import Semaphore from 'semaphore-async-await';
import { HotaruError, HotaruUser, UserDataStore } from 'hotaru';
import freshId from './utils/freshId';
import stripInternalFields from './utils/stripInternalFields';
import parseJsonDates from './utils/parseJsonDates';
import Query from './db//Query';
import SavingMode from './db/SavingMode';
import { MongoAdapter }  from './db/MongoAdapter';
import DbAdapter from './db/DbAdapter';
import InternalDbAdapter from './db/InternalDbAdapter';

const PACKAGE_VERSION = require(`${__dirname}/../package.json`).version; // eslint-disable-line

const locks = defaultdict(() => new Semaphore(1));

// This should eventually be a decorator
function routeHandlerWrapper(routeHandler, debug = false) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    const body = parseJsonDates(req.body);

    try {
      const result = await routeHandler(body);
      res.send(JSON.stringify({ status: 'ok', result, serverVersion: PACKAGE_VERSION }));
    } catch (error) {
      let response;
      if (error instanceof HotaruError) {
        response = { status: 'error', code: error.code, message: error.message };
      } else if (debug) {
        response = { status: 'error', code: -1, message: error.toString(), stack: error.stack };
      } else {
        response = { status: 'error', code: -1, message: 'Internal error' };
      }
      res.send(JSON.stringify(response));
    }
  };
}

function loggedInRouteHandlerWrapper(loggedInRouteHandler, dbAdapter) {
  return async (body) => {
    const { sessionId } = body;

    if (sessionId === undefined) {
      throw new HotaruError(HotaruError.NOT_LOGGED_IN);
    }

    const sessionQuery = new Query('_Session');
    sessionQuery.equalTo('_id', sessionId);
    const session = await dbAdapter.internalFirst(sessionQuery);

    if (session === null) {
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    await locks[session.userId].wait();
    try {
      const userQuery = new Query('_User');
      userQuery.equalTo('_id', session.userId);
      const userData = await dbAdapter.internalFirst(userQuery);

      if (userData === null) {
        // This is weird, the user must've gotten deleted after the session was created.
        // The best course of action here is probably to delete the session and pretend
        // it didn't exist
        await dbAdapter.internalDeleteObject('_Session', session);
        throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
      }

      const user = new HotaruUser(new UserDataStore(userData, userData.__changelog));

      // await is necessary because loggedInRouteHandler has to finish executing before
      // we release the lock.
      return await loggedInRouteHandler(body, sessionId, user);
    } finally {
      locks[session.userId].signal();
    }
  };
}

type CloudFunction = {
  name: string, 
  func: (dbAdapter: DbAdapter, user: HotaruUser, params: any, installationDetails: any) => any
};

interface ConstructorParameters {
  dbAdapter: InternalDbAdapter;
  cloudFunctions: Array<CloudFunction>;
  validatePassword: (password: string) => boolean;
  debug: boolean;
}
  const validatePassword = (p:string) => p.length > 6;
export default class HotaruServer {

  private dbAdapter: InternalDbAdapter;
  private cloudFunctions: Array<CloudFunction>;
  private validatePassword: (password: string) => boolean;
  private debug: boolean;



  constructor({ dbAdapter, cloudFunctions, validatePassword = p => p.length > 6, debug = false }: ConstructorParameters) {
    this.dbAdapter = dbAdapter;
    this.cloudFunctions = cloudFunctions;
    this.validatePassword = validatePassword;
    this.debug = debug;

    _.bindAll(this, ['logInAsGuest', 'signUp', 'convertGuestUser', 'logIn', 'logOut', 'synchronizeUser', 'runCloudFunction']);
  }


  static createServer({ dbAdapter, cloudFunctions, debug = false }) {
    const server = new HotaruServer({ dbAdapter, cloudFunctions, validatePassword, debug });
    const router = Router({ caseSensitive: true }); // eslint-disable-line new-cap
    router.use(json());

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

    router.post('/_synchronizeUser', (req, res) =>
      routeHandlerWrapper(loggedInRouteHandlerWrapper(server.synchronizeUser, dbAdapter), server.debug)(req, res));

    cloudFunctions.forEach(({ name }) => {
      if (!isAlphanumeric(name)) {
        throw new HotaruError(HotaruError.CLOUD_FUNCTION_NAMES_MUST_BE_ALPHANUMERIC);
      }

      router.post(`/${name}`, (req, res) =>
        routeHandlerWrapper(loggedInRouteHandlerWrapper(server.runCloudFunction(name), dbAdapter), server.debug)(req, res));
    });

    return router;
  }


  static _freshUserObject(email?: string, hashedPassword?: string) {
    const now = new Date();
    return {
      email,
      __hashedPassword: hashedPassword,
      __changelog: [],
      createdAt: now,
      updatedAt: now,
    };
  }


  async logInAsGuest(_body) {
    const newInternalUser = await this.dbAdapter.internalSaveObject(
      '_User',
      HotaruServer._freshUserObject(null, null),
      { savingMode: SavingMode.CreateOnly }
    );

    // TODO If creating the session fails, we should delete the user and return an error
    const newSession = await this.dbAdapter.internalSaveObject(
      '_Session',
      {
        _id: freshId(32),
        userId: newInternalUser._id,
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
        // TODO installationId
      },
      { savingMode: SavingMode.CreateOnly }
    );

    const newUserData = stripInternalFields(newInternalUser);
    return { sessionId: newSession._id, userData: newUserData };
  }


  async signUp(body) {
    const { email, password } = body;

    if (!isEmail(email)) {
      throw new HotaruError(HotaruError.INVALID_EMAIL_ADDRESS);
    }

    if (!this.validatePassword(password)) {
      throw new HotaruError(HotaruError.INVALID_PASSWORD);
    }

    const existingUserQuery = new Query('_User');
    existingUserQuery.equalTo('email', email);
    const existingUser = await this.dbAdapter.internalFirst(existingUserQuery);

    if (existingUser !== null) {
      throw new HotaruError(HotaruError.USER_ALREADY_EXISTS);
    }

    const hashedPassword = hashSync(password, 10);

    const newInternalUser = await this.dbAdapter.internalSaveObject(
      '_User',
      HotaruServer._freshUserObject(email, hashedPassword),
      { savingMode: SavingMode.CreateOnly }
    );

    // TODO If creating the session fails, we should delete the user and return an error
    const newSession = await this.dbAdapter.internalSaveObject(
      '_Session',
      {
        _id: freshId(32),
        userId: newInternalUser._id,
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
        // TODO installationId
      },
      { savingMode: SavingMode.CreateOnly }
    );

    const newUserData = stripInternalFields(newInternalUser);
    return { sessionId: newSession._id, userData: newUserData };
  }


  async convertGuestUser(body, sessionId, user) {
    const { email, password } = body;

    if (user.get('email') !== null) {
      throw new HotaruError(HotaruError.CAN_NOT_CONVERT_NON_GUEST_USER);
    }

    user.set('email', email);
    const hashedPassword = hashSync(password, 10);
    user._internalSet('__hashedPassword', hashedPassword);

    const savedUser = await this.dbAdapter.saveUser(user);

    return { userData: stripInternalFields(savedUser._getDataStore().getRawData()) };
  }


  async logIn(body) {
    const { email, password } = body;

    const userQuery = new Query('_User');
    userQuery.equalTo('email', email);
    const internalUserData = await this.dbAdapter.internalFirst(userQuery);

    if (internalUserData === null) {
      throw new HotaruError(HotaruError.NO_USER_WITH_GIVEN_EMAIL_ADDRESS);
    }

    if (!compareSync(password, internalUserData.__hashedPassword)) {
      throw new HotaruError(HotaruError.INCORRECT_PASSWORD);
    }

    const newSession = await this.dbAdapter.internalSaveObject(
      '_Session',
      {
        _id: freshId(32),
        userId: internalUserData._id,
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
        // TODO installationId
      },
      { savingMode: SavingMode.CreateOnly }
    );
    const strippedUserData = stripInternalFields(internalUserData);

    return { sessionId: newSession._id, userData: strippedUserData };
  }


  async logOut(_body, sessionId, _user) {
    const sessionQuery = new Query('_Session');
    sessionQuery.equalTo('_id', sessionId);
    const session = await this.dbAdapter.internalFirst(sessionQuery);

    if (session === null) {
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    const success = await this.dbAdapter.internalDeleteObject('_Session', session);

    if (!success) {
      throw new HotaruError(HotaruError.LOGOUT_FAILED);
    }
    return {};
  }


  async synchronizeUser(body, sessionId, user) {
    const { clientChangelog } = body;

    const userData = user._getDataStore().getRawData();
    let localChangelog = user._getDataStore().getChangelog();

    const sortedClientChangelog = clientChangelog.sort((a, b) => a.date - b.date);
    sortedClientChangelog.forEach(change => {
      switch (change.type) {
        case 'set':
          {
            const existingNewerSet = localChangelog.find(c =>
              c.type === 'set' && c.date > change.date && c.field === change.field
            );
            if (existingNewerSet === undefined) {
              localChangelog = localChangelog.filter(c => c.field !== change.field || c.date > change.date);
              const laterLocalIncrementsAndAppends = localChangelog.filter(c => c.field === change.field);
              userData[change.field] = change.value;
              laterLocalIncrementsAndAppends.forEach(c => {
                if (c.type === 'increment') {
                  userData[change.field] += c.value;
                } else if (c.type === 'append') {
                  userData[change.field].append(c.value);
                } else {
                  throw new HotaruError(HotaruError.INVALID_CHANGE_TYPE);
                }
              });
              localChangelog.push(change);
            }
          }
          break;
        case 'increment':
          {
            const existingNewerSet = localChangelog.find(c =>
              c.type === 'set' && c.date > change.date && c.field === change.field
            );
            if (existingNewerSet === undefined) {
              if (userData[change.field] === undefined) {
                userData[change.field] = 0;
              }
              userData[change.field] += change.value;
              localChangelog.push(change);
            }
          }
          break;
        case 'append':
          {
            const existingNewerSet = localChangelog.find(c =>
              c.type === 'set' && c.date > change.date && c.field === change.field
            );
            if (existingNewerSet === undefined) {
              if (userData[change.field] === undefined) {
                userData[change.field] = [];
              }
              userData[change.field].push(change.value);
              localChangelog.push(change);
            }
          }
          break;
        default: throw new HotaruError(HotaruError.INVALID_CHANGE_TYPE, change.type);
      }
    });

    // We append new changes at the end in the loop above even if they should be placed
    // somewhere in the middle
    localChangelog.sort((a, b) => a.date - b.date);

    const newUser = new HotaruUser(new UserDataStore(userData, localChangelog));

    const savedNewUser = await this.dbAdapter.saveUser(newUser);
    const processedChanges = clientChangelog.map(c => c._id);

    return { userData: stripInternalFields(savedNewUser._getDataStore().getRawData()), processedChanges };
  }


  runCloudFunction(cloudFunctionName) {
    return async (body, sessionId, user) => {
      const { params, installationDetails } = body;

      const cloudFunction = this.cloudFunctions.find(({ name }) => cloudFunctionName === name).func;
      return await cloudFunction(this.dbAdapter, user, params, installationDetails);
    };
  }
}
