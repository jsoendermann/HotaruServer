import { MongoClient } from 'mongodb';
import _ from 'lodash';
import { isAlphanumeric } from 'validator';
import { HotaruUser, HotaruError, UserDataStore } from 'hotaru';
import { freshId, stripInternalFields, SavingMode } from './utils';


export default class MongoAdapter {
  constructor({ uri }) {
    this._uri = uri;
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


  static _convertQuerySelectors(selectors) {
    const mongoSelectors = [];

    for (const selector of selectors) {
      switch (selector.type) {
        case 'equalTo':
          mongoSelectors.push({ [selector.key]: { $eq: selector.value } });
          break;
        case 'notEqualTo':
          mongoSelectors.push({ [selector.key]: { $ne: selector.value } });
          break;
        case 'lessThan':
          mongoSelectors.push({ [selector.key]: { $lt: selector.value } });
          break;
        case 'lessThanOrEqual':
          mongoSelectors.push({ [selector.key]: { $lte: selector.value } });
          break;
        case 'greaterThan':
          mongoSelectors.push({ [selector.key]: { $gt: selector.value } });
          break;
        case 'greaterThanOrEqual':
          mongoSelectors.push({ [selector.key]: { $gte: selector.value } });
          break;
        case 'containedIn':
          mongoSelectors.push({ [selector.key]: { $in: selector.value } });
          break;
        case 'notContainedIn':
          mongoSelectors.push({ [selector.key]: { $nin: selector.value } });
          break;
        case 'mod':
          mongoSelectors.push({ [selector.key]: { $mod: [selector.divisor, selector.remainder] } });
          break;
        case 'regex':
          mongoSelectors.push({ [selector.key]: { $regex: selector.regex, $options: selector.options } });
          break;
        case 'where':
          mongoSelectors.push({ $where: selector.expressionString });
          break;
        default: throw new HotaruError(HotaruError.UNKNOWN_QUERY_SELECTOR, selector.type);
      }
    }

    if (mongoSelectors.length > 0) {
      return { $and: mongoSelectors };
    }
    return {};
  }


  static _convertQuerySortOperators(sortOperators) {
    const mongoSortOperators = [];

    for (const sortOperator of sortOperators) {
      switch (sortOperator.type) {
        case 'ascending':
          mongoSortOperators.push([sortOperator.key, 1]);
          break;
        case 'descending':
          mongoSortOperators.push([sortOperator.key, -1]);
          break;
        default: throw new HotaruError(HotaruError.UNKNOWN_SORT_OPERATOR, sortOperator.type);
      }
    }

    return mongoSortOperators;
  }


  async _internalFind(query) {
    const collection = await this._getCollection(query._className);

    let objectsPromise = collection
      .find(MongoAdapter._convertQuerySelectors(query._selectors))
      .sort(MongoAdapter._convertQuerySortOperators(query._sortOperators));
    if (query._limit) {
      objectsPromise = objectsPromise.limit(query._limit);
    }
    if (query._skip) {
      objectsPromise = objectsPromise.skip(query._skip);
    }
    objectsPromise = objectsPromise.toArray();

    return objectsPromise;
  }


  async find(query) {
    const objects = await this._internalFind(query);
    return objects.map(obj => stripInternalFields(obj));
  }


  async _internalFirst(query) {
    query.limit(1);
    const [object] = await this._internalFind(query);
    return object || null;
  }


  async first(query) {
    query.limit(1);
    const [object] = await this.find(query);
    return object || null;
  }


  async _internalSaveAll(className, objects, { savingMode = SavingMode.UPSERT } = {}) {
    // Make sure savingMode is a valid value
    if (!Object.keys(SavingMode).map(k => SavingMode[k]).includes(savingMode)) {
      throw new HotaruError(HotaruError.UNKNOWN_SAVING_MODE, String(savingMode));
    }

    // Make sure objects does not contain the same existing object more than once
    const oldIds = objects.map(obj => obj._id).filter(id => id !== undefined);
    if (_.uniq(oldIds).length < oldIds.length) {
      throw new HotaruError(HotaruError.CAN_NOT_SAVE_TWO_OBJECTS_WITH_SAME_ID);
    }

    // If we are in UPDATE_ONLY mode, every object has to have an _id
    if (savingMode === SavingMode.UPDATE_ONLY &&
      objects.includes(obj => obj._id === undefined)) {
      throw new HotaruError(HotaruError.OBJECT_WITHOUT_ID_IN_UPDATE_ONLY_SAVING_MODE);
    }

    const collection = await this._getCollection(className);
    const existingObjects = await collection.find({ _id: { $in: oldIds } }).toArray();

    if (savingMode === SavingMode.CREATE_ONLY && existingObjects.length > 0) {
      throw new HotaruError(HotaruError.CAN_NOT_OVERWRITE_OBJECT_IN_CREATE_ONLY_SAVING_MODE);
    } else if (savingMode === SavingMode.UPDATE_ONLY && existingObjects.length !== objects.length) {
      throw new HotaruError(HotaruError.CAN_NOT_CREATE_NEW_OBJECT_IN_UPDATE_ONLY_SAVING_MODE);
    }

    const oldAndNewIds = [];
    const objectCopies = objects.map(o => Object.assign({}, o));
    const now = new Date();
    for (const obj of objectCopies) {
      // Create fresh _ids for new objects which don't have an _id yet. Note: We allow objects with _id !== undefined
      // in CREATE_ONLY savingMode because the user might want to set the _id herself to something other than freshId() on new objects
      obj._id = obj._id || freshId();
      obj.createdAt = obj.createdAt || now;
      obj.updatedAt = now;

      oldAndNewIds.push(obj._id);

      // Copy over internal fields from existing objects if they weren't set so that they don't
      // get ovewritten with undefined
      const existingObject = existingObjects.find(exObj => exObj._id === obj._id);
      if (existingObject !== undefined) {
        for (const key of Object.keys(existingObject)) {
          if (key.startsWith('__') && obj[key] === undefined) {
            obj[key] = existingObject[key];
          }
        }
      }
    }

    const bulkOp = collection.initializeUnorderedBulkOp();

    objectCopies.forEach(obj => {
      bulkOp.find({ _id: obj._id }).upsert().update({ $set: obj });
    });

    await bulkOp.execute();

    return collection.find({ _id: { $in: oldAndNewIds } }).toArray();
  }


  async saveAll(className, objects, { savingMode = SavingMode.UPSERT } = {}) {
    if (!(isAlphanumeric(className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
    }

    const savedObjects = await this._internalSaveAll(className, objects, { savingMode });
    return savedObjects.map(obj => stripInternalFields(obj));
  }


  async _internalSaveObject(className, object, { savingMode = SavingMode.UPSERT } = {}) {
    const [savedObject] = await this._internalSaveAll(className, [object], { savingMode });
    return savedObject;
  }


  async saveObject(className, object, { savingMode = SavingMode.UPSERT } = {}) {
    const [savedObject] = await this.saveAll(className, [object], { savingMode });
    return savedObject;
  }


  async saveUser(user) {
    const data = user._getDataStore().getRawData();
    data.__changelog = user._getDataStore().getChangelog();
    const savedUserData = await this._internalSaveObject('_User', data, { savingMode: SavingMode.UPDATE_ONLY });
    return new HotaruUser(new UserDataStore(savedUserData, savedUserData.__changelog));
  }


  async deleteObject(className, object) {
    return this.deleteAll(className, [object]);
  }


  async _internalDeleteObject(className, object) {
    return this._internalDeleteAll(className, [object]);
  }


  async deleteAll(className, objects) {
    if (!(isAlphanumeric(className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
    }

    return this._internalDeleteAll(className, objects);
  }


  async _internalDeleteAll(className, objects) {
    const ids = [];
    for (const object of objects) {
      if (object._id === undefined) {
        throw new HotaruError(HotaruError.CAN_NOT_DELETE_OBJECT_WITHOUT_ID);
      }
      ids.push(object._id);
    }

    // Make sure objects does not contain the same existing object more than once
    if (_.uniq(ids).length < ids.length) {
      throw new HotaruError(HotaruError.CAN_NOT_DELETE_TWO_OBJECTS_WITH_SAME_ID);
    }

    const collection = await this._getCollection(className);
    const result = await collection.deleteMany({ _id: { $in: ids } });
    return result.result.ok === 1;
  }
}
