import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';
import _ from 'lodash';
import { freshId, validateEmail, isAlphanum } from './utils';
import HotaruError from './HotaruError';


export default class MongoAdapter {
  static get SavingMode() {
    return {
      UPSERT: Symbol.for('upsert'),
      CREATE_ONLY: Symbol.for('create only'),
      UPDATE_ONLY: Symbol.for('update only'),
    };
  }

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

  async saveUser(user) {
    const savedUser = await this.saveObject(
      '_User',
      user,
      {
        savingMode: MongoAdapter.SavingMode.UPDATE_ONLY,
        _allowSavingToInternalClasses: true,
      }
    );
    return savedUser;
  }

  async saveObject(className, object, { savingMode = MongoAdapter.SavingMode.UPSERT, _allowSavingToInternalClasses = false } = {}) {
    const [savedObject] = await this.saveAll(className, [object], { savingMode, _allowSavingToInternalClasses });
    return savedObject;
  }

  async saveAll(className, objects, { savingMode = MongoAdapter.SavingMode.UPSERT, _allowSavingToInternalClasses = false } = {}) {
    // Make sure savingMode is a valid value
    if (!Object.values(MongoAdapter.SavingMode).includes(savingMode)) {
      throw new HotaruError(HotaruError.UNKNOWN_SAVING_MODE, String(savingMode));
    }

    // Only allow saving to classes with non-alphanumeric names if _allowSavingToInternalClasses is true
    if (!(isAlphanum(className) || _allowSavingToInternalClasses)) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
    }

    // Make sure objects does not contain the same existing object more than once
    const existingObjects = objects.filter(obj => obj._id !== undefined);
    if (_.uniq(existingObjects.map(o => o._id)).length < existingObjects.length) {
      throw new HotaruError(HotaruError.CAN_NOT_SAVE_TWO_OBJECTS_WITH_SAME_ID);
    }

    if (savingMode === MongoAdapter.SavingMode.UPDATE_ONLY &&
      objects.includes(obj => obj._id === undefined)) {
      throw new HotaruError(HotaruError.OBJECT_WITHOUT_ID_IN_UPDATE_ONLY_SAVING_MODE);
    }

    const now = new Date();
    for (const obj of objects) {
      // Create fresh _ids for new objects which don't have an _id yet. Note: We allow objects with _id !== undefined
      // in CREATE_ONLY savingMode because the user might want to set the _id herself to something other than freshId() on new objects
      obj._id = obj._id || freshId();
      obj.createdAt = obj.createdAt || now;
      obj.updatedAt = now;
    }

    const collection = await this._getCollection(className);

    const ids = objects.map(obj => obj._id);
    if (savingMode === MongoAdapter.SavingMode.CREATE_ONLY || savingMode === MongoAdapter.SavingMode.UPDATE_ONLY) {
      const existingObjectsWithIdInIds = await collection.find({ _id: { $in: ids } }).toArray();

      if (savingMode === MongoAdapter.SavingMode.CREATE_ONLY && existingObjectsWithIdInIds.length > 0) {
        throw new HotaruError(HotaruError.CAN_NOT_OVERWRITE_OBJECT_IN_CREATE_ONLY_SAVING_MODE);
      } else if (savingMode === MongoAdapter.SavingMode.UPDATE_ONLY && existingObjectsWithIdInIds.length !== objects.length) {
        throw new HotaruError(HotaruError.CAN_NOT_CREATE_NEW_OBJECT_IN_UPDATE_ONLY_SAVING_MODE);
      }
    }

    const bulkOp = collection.initializeUnorderedBulkOp();

    objects.forEach(obj => {
      bulkOp.find({ _id: obj._id }).upsert().update({ $set: obj });
    });

    await bulkOp.execute();

    return await collection.find({ _id: { $in: ids } }).toArray();
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

    const newUser = await this.saveUser(
      MongoAdapter._freshUserObject(email, hashedPassword, false),
      { savingMode: MongoAdapter.SavingMode.CREATE_ONLY }
    );

    return newUser;
  }

  async _createGuestUser() {
    const newGuestUser = await this.saveUser(MongoAdapter._freshUserObject(null, null, true));

    return newGuestUser;
  }

  async _createSession(userId) {
    const newSession = await this.saveObject(
      '_Session',
      {
        _id: freshId(32),
        userId,
        createdAt: new Date(),
        expiresAt: new Date('Jan 1, 2039'),
        // installationId
      },
      { _allowSavingToInternalClasses: true }
    );

    return newSession;
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
