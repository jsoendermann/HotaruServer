import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';
import _ from 'lodash';
import { freshId, validateEmail } from './utils';
import HotaruError from './HotaruError';


export default class MongoAdapter {
  constructor({ uri, schema, validatePassword = p => p.length > 6 }) {
    this._uri = uri;
    this._schema = schema;
    this._validatePassword = validatePassword;
  }

  async _getDb() {
    if (this._connectionPromise) {
      return this._connectionPromise;
    }

    this._connectionPromise = MongoClient.connect(this._uri).then(db => {
      if (!db) {
        delete this._connectionPromise;
        throw new Error('db is falsy');
      }

      db.on('error', () => delete this._connectionPromise);
      db.on('close', () => delete this._connectionPromise);

      return db;
    }).catch(error => {
      delete this._connectionPromise;
      return Promise.reject(error);
    });

    return this._connectionPromise;
  }

  async _getCollection(collectionName) {
    const db = await this._getDb();
    return db.collection(collectionName);
  }

  async _getUserCollection() {
    return this._getCollection('_User');
  }

  async _getSessionCollection() {
    return this._getCollection('_Session');
  }

  // find(query) {

  // }

  // first(query) {

  // }

  async save(className, objects) {
    const existingObjects = objects.filter(obj => obj._id !== undefined);

    // Make sure objects does not contain the same existing object more than once
    if (_.uniq(existingObjects.map(o => o._id)).length < existingObjects.length) {
      throw new HotaruError(HotaruError.CAN_NOT_SAVE_TWO_OBJECTS_WITH_SAME_ID);
    }

    const now = new Date();
    for (const obj of objects) {
      obj._id = obj._id || freshId();
      obj.createdAt = obj.createdAt || now;
      obj.updatedAt = now;
    }

    const collection = await this._getCollection(className);
    const bulkOp = collection.initializeUnorderedBulkOp();

    objects.forEach(obj => {
      bulkOp.find({ _id: obj._id }).upsert().update({ $set: obj });
    });

    return bulkOp.execute();
  }

  static _freshUserObject(email, hashedPassword, isGuest) {
    const now = new Date();
    return {
      _id: freshId(),
      email,
      __hashedPassword: hashedPassword,
      __isGuest: isGuest,
      createdAt: now,
      updatedAt: now,
    };
  }

  async _createUser(email, password) {
    if (!validateEmail(email)) {
      throw new HotaruError(HotaruError.INVALID_EMAIL_ADDRESS);
    }
    if (!this._validatePassword(password)) {
      throw new HotaruError(HotaruError.INVALID_PASSWORD);
    }
    const _User = await this._getUserCollection();

    const existingUser = await _User.findOne({ email });
    if (existingUser !== null) {
      throw new HotaruError(HotaruError.USER_ALREADY_EXISTS);
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const writeOpResult = await _User.insertOne(MongoAdapter._freshUserObject(email, hashedPassword, false));
    const newUser = writeOpResult.ops[0];

    return newUser;
  }

  async _createGuestUser() {
    const _User = await this._getUserCollection();

    const writeOpResult = await _User.insertOne(MongoAdapter._freshUserObject(null, null, true));
    const newGuestUser = writeOpResult.ops[0];

    return newGuestUser;
  }

  async _createSession(userId) {
    const _Session = await this._getSessionCollection();
    const newSession = {
      _id: freshId(32),
      userId,
      createdAt: new Date(),
      expiresAt: new Date('Jan 1, 2039'),
      // installationId
    };

    const writeOpResult = await _Session.insertOne(newSession);

    return writeOpResult.ops[0];
  }

  async _getUserWithSessionId(sessionId) {
    const _Session = await this._getSessionCollection();
    const session = await _Session.findOne({ _id: sessionId });

    if (session === null) {
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    const _User = await this._getUserCollection();
    const user = await _User.findOne({ _id: session.userId });

    if (user === null) {
      // This is weird, the user must've gotten deleted after the session was created.
      // The best course of action here is probably to delete the session and pretend
      // it didn't exist
      await _Session.deleteOne({ _id: session._id });
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    return user;
  }

  async _endSession(sessionId) {
    const _Session = await this._getSessionCollection();
    const session = await _Session.findOne({ _id: sessionId });

    if (session === null) {
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    return _Session.deleteOne({ _id: session._id });
  }

  async _getUserWithEmail(email) {
    const _User = await this._getUserCollection();
    const user = await _User.findOne({ email });

    if (user === null) {
      throw new HotaruError(HotaruError.NO_USER_WITH_GIVEN_EMAIL_ADDRESS);
    }

    return user;
  }
}
