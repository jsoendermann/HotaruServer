import { Router } from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import _ from 'lodash';
import HotaruError from './HotaruError';
import { isAlphanum } from './utils';

// This should eventually be a decorator
function routeHandlerWrapper(routeHandler, debug = false) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      const result = await routeHandler(req);
      res.send(JSON.stringify({ status: 'ok', result }));
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

function loggedInRouteHandlerWrapper(loggedInRouteHandler) {
  return async (req) => {
    const { sessionId } = req.body;

    if (sessionId === undefined) {
      throw new HotaruError(HotaruError.NOT_LOGGED_IN);
    }

    return await loggedInRouteHandler(req, sessionId);
  };
}

export default class HotaruServer {

  constructor({ dbAdapter, cloudFunctions, debug = false }) {
    this.dbAdapter = dbAdapter;
    this.cloudFunctions = cloudFunctions;
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
      routeHandlerWrapper(loggedInRouteHandlerWrapper(server.convertGuestUser), server.debug)(req, res));
    router.post('/_logIn', (req, res) =>
      routeHandlerWrapper(server.logIn, server.debug)(req, res));
    router.post('/_logOut', (req, res) =>
      routeHandlerWrapper(loggedInRouteHandlerWrapper(server.logOut), server.debug)(req, res));

    cloudFunctions.forEach(({ name }) => {
      if (!isAlphanum(name)) {
        throw new HotaruError(HotaruError.CLOUD_FUNCTION_NAMES_MUST_BE_ALPHANUMERIC);
      }

      router.post(`/${name}`, (req, res) => routeHandlerWrapper(loggedInRouteHandlerWrapper(server.runCloudFunction(name)), server.debug)(req, res));
    });

    return router;
  }

  async logInAsGuest(_req) {
    const newUser = await this.dbAdapter._createGuestUser();

    // TODO If creating the session fails, we should delete the user and return an error
    const newSession = await this.dbAdapter._createSession(newUser._id);
    return { sessionId: newSession._id };
  }

  async signUp(req) {
    const { email, password } = req.body;

    const newUser = await this.dbAdapter._createUser(email, password);

    // TODO If creating the session fails, we should delete the user and return an error
    const newSession = await this.dbAdapter._createSession(newUser._id);
    return { sessionId: newSession._id };
  }

  async convertGuestUser(req, sessionId) {
    const { email, password } = req.body;

    const user = await this.dbAdapter._getUserWithSessionId(sessionId);

    if (!user.__isGuest) {
      throw new HotaruError(HotaruError.CAN_NOT_CONVERT_NON_GUEST_USER);
    }

    user.email = email;
    // TODO extract password management into a separate module
    user.__hashedPassword = bcrypt.hashSync(password, 10);
    user.__isGuest = false;

    await this.dbAdapter.saveUser(user);

    return {};
  }

  async logIn(req) {
    const { email, password } = req.body;

    const user = await this.dbAdapter._getUserWithEmail(email);
    if (!bcrypt.compareSync(password, user.__hashedPassword)) {
      throw new HotaruError(HotaruError.INCORRECT_PASSWORD);
    }

    const newSession = await this.dbAdapter._createSession(user._id);

    return { sessionId: newSession._id };
  }

  async logOut(req, sessionId) {
    const success = await this.dbAdapter._endSession(sessionId);

    if (!success) {
      throw new HotaruError(HotaruError.LOGOUT_FAILED);
    }
    return {};
  }

  runCloudFunction(cloudFunctionName) {
    return async (req, sessionId) => {
      const { params, installationDetails } = req.body;

      const user = await this.dbAdapter._getUserWithSessionId(sessionId);
      this.dbAdapter.constructor._stripInternalFields(user);

      const cloudFunction = this.cloudFunctions.find(({ name }) => cloudFunctionName === name).func;
      return await cloudFunction(this.dbAdapter, user, params, installationDetails);
    };
  }
}
