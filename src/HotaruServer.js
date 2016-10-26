import { Router } from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import HotaruError from './HotaruError';

// This should eventually be a decorator
function routeHandlerWrapper(routeHandler, debug = false) {
  return async function (req, res) {
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

export default class HotaruServer {

  constructor({ dbAdapter, cloudFunctions, debug = false }) {
    this.dbAdapter = dbAdapter;
    this.cloudFunctions = cloudFunctions;

    this.logInAsGuest = routeHandlerWrapper(this.logInAsGuest.bind(this), debug);
    this.signUp = routeHandlerWrapper(this.signUp.bind(this), debug);
    this.convertGuestUser = routeHandlerWrapper(this.convertGuestUser.bind(this), debug);
    this.logIn = routeHandlerWrapper(this.logIn.bind(this), debug);
    this.logOut = routeHandlerWrapper(this.logOut.bind(this), debug);
  }

  static createServer(args) {
    const server = new HotaruServer(args);
    const router = Router({ caseSensitive: true }); // eslint-disable-line new-cap
    router.use(bodyParser.json());

    router.post('/_logInAsGuest', server.logInAsGuest);
    router.post('/_signUp', server.signUp);
    router.post('/_convertGuestUser', server.convertGuestUser);
    router.post('/_logIn', server.logIn);
    router.post('/_logOut', server.logOut);

    // router.post('/_synchronizeUser', (res, req) => logIn(req, res, dbAdapter));
    // router.post('/_synchronizeObjects', (res, req) => logIn(req, res, dbAdapter));

    // cloudFunctions.forEach(({ name, func }) => {
    //     if (!/^[a-z0-9]+$/i.test(name)) {
    //         throw new Error(`Cloud function names must be alphanumeric, "${name}" isn't.`);
    //     }


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

  async convertGuestUser(req) {
    const { email, password, sessionId } = req.body;

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

  async logOut(req) {
    const { sessionId } = req.body;

    const result = await this.dbAdapter._endSession(sessionId);

    if (!result.result.ok) {
      throw new HotaruError(HotaruError.LOGOUT_FAILED);
    }
    return {};
  }
}
