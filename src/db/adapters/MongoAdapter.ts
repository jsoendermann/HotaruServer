import { MongoClient, Db, Collection } from 'mongodb';
import * as _ from 'lodash';
import { isAlphanumeric } from 'validator';
import { HotaruUser, HotaruError, UserDataStore } from 'hotaru';
import freshId from '../../utils/freshId';
import InternalDbAdapter from './InternalDbAdapter';
import { Query, Selector, SortOperator } from '../Query';

export enum SavingMode {
  Upsert,
  CreateOnly,
  UpdateOnly
}

interface ConstructorParameters {
  uri: string;
}

interface SavingParameters {
  savingMode?: SavingMode;
}

export class MongoAdapter extends InternalDbAdapter {
  private uri: string;
  private connectionPromise: Promise<Db>;

  public stripInternalFields(object: any): any {
    const ret: { [attr: string]: any } = {};

    for (const attribute of Object.keys(object)) {
      if (!attribute.startsWith('__')) {
        ret[attribute] = object[attribute];
      }
    }

    return ret;
  }

  constructor({ uri }: ConstructorParameters) {
    super();

    this.uri = uri;
  }


  private async getDb(): Promise<Db> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = MongoClient.connect(this.uri).then((db: Db) => {
      if (!db) {
        delete this.connectionPromise;
        throw new Error('db is falsy');
      }

      db.on('error', () => delete this.connectionPromise);
      db.on('close', () => delete this.connectionPromise);

      return db;
    }).catch(error => {
      delete this.connectionPromise;
      return Promise.reject(error);
    });

    return this.connectionPromise;
  }


  private async getCollection(collectionName: string): Promise<Collection> {
    const db = await this.getDb();
    return db.collection(collectionName);
  }


  private async getUserCollection(): Promise<Collection> {
    return this.getCollection('_User');
  }


  private async getSessionCollection(): Promise<Collection> {
    return this.getCollection('_Session');
  }


  private static convertQuerySelectors(selectors: Selector[]): any {
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
      }
    }

    if (mongoSelectors.length > 0) {
      return { $and: mongoSelectors };
    }

    return {};
  }


  private static convertQuerySortOperators(sortOperators: SortOperator[]) {
    const mongoSortOperators = [];

    for (const sortOperator of sortOperators) {
      switch (sortOperator.type) {
        case 'ascending':
          mongoSortOperators.push([sortOperator.key, 1]);
          break;
        case 'descending':
          mongoSortOperators.push([sortOperator.key, -1]);
          break;
      }
    }

    return mongoSortOperators;
  }


  public async internalFind(query: Query): Promise<any[]> {
    const collection = await this.getCollection(query.className);

    let objectsPromise = collection
      .find(MongoAdapter.convertQuerySelectors(query.selectors))
      .sort(MongoAdapter.convertQuerySortOperators(query.sortOperators));
    if (query.limit) {
      objectsPromise = objectsPromise.limit(query.limit);
    }
    if (query.skip) {
      objectsPromise = objectsPromise.skip(query.skip);
    }
    const objects = await objectsPromise.toArray();

    return objects;
  }


  public async internalFirst(query: Query): Promise<any> {
    query.limit = 1;
    const [object] = await this.internalFind(query);
    return object || null;
  }

  public async internalSaveAll(
    className: string, 
    objects: any[], 
    { savingMode = SavingMode.Upsert }: SavingParameters = {}
  ) {
    // Make sure objects does not contain the same existing object more than once
    const oldIds = objects.map(obj => obj._id).filter(id => id !== undefined);
    if (_.uniq(oldIds).length < oldIds.length) {
      throw new HotaruError(HotaruError.CAN_NOT_SAVE_TWO_OBJECTS_WITH_SAME_ID);
    }

    // If we are in UpdateOnly mode, every object has to have an _id
    if (savingMode === SavingMode.UpdateOnly &&
      objects.includes((obj: any) => obj._id === undefined)) {
      throw new HotaruError(HotaruError.OBJECT_WITHOUT_ID_IN_UPDATE_ONLY_SAVING_MODE);
    }

    const collection = await this.getCollection(className);
    const existingObjects = await collection.find({ _id: { $in: oldIds } }).toArray();

    if (savingMode === SavingMode.CreateOnly && existingObjects.length > 0) {
      throw new HotaruError(HotaruError.CAN_NOT_OVERWRITE_OBJECT_IN_CREATE_ONLY_SAVING_MODE);
    } else if (savingMode === SavingMode.UpdateOnly && existingObjects.length !== objects.length) {
      throw new HotaruError(HotaruError.CAN_NOT_CREATE_NEW_OBJECT_IN_UPDATE_ONLY_SAVING_MODE);
    }

    const oldAndNewIds = [];
    const objectCopies = objects.map(o => Object.assign({}, o));
    const now = new Date();
    for (const obj of objectCopies) {
      // Create fresh _ids for new objects which don't have an _id yet. Note: We allow objects with _id !== undefined
      // in CreateOnly savingMode because the user might want to set the _id herself to something other than freshId() on new objects
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



  public async internalSaveObject(className: string, object: any, { savingMode = SavingMode.Upsert } = {}) {
    const [savedObject] = await this.internalSaveAll(className, [object], { savingMode });
    return savedObject;
  }



  public async internalDeleteAll(className: string, objects: any[]): Promise<boolean> {
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

    const collection = await this.getCollection(className);
    const result = await collection.deleteMany({ _id: { $in: ids } });
    return result.result.ok === 1;
  }

  public async internalDeleteObject(className: string, object: any) {
    return this.internalDeleteAll(className, [object]);
  }
}
