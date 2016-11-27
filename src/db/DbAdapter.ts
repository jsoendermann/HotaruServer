import Query from './Query';
import { isAlphanumeric } from 'validator';
import { HotaruError, HotaruUser, UserDataStore } from 'hotaru';
import SavingOptions from './SavingOptions';
import SavingMode from './SavingMode';


abstract class DbAdapter {
  protected abstract stripInternalFields(object: any): any;

  protected abstract async internalFind(query: Query): Promise<Array<any>>;
  protected abstract async internalFirst(query: Query): Promise<any>;
  protected abstract async internalSaveAll(className: string, objects: Array<any>, options: SavingOptions): Promise<Array<any>>;
  protected abstract async internalSaveObject(className: string, object: any, options: SavingOptions): Promise<any>;
  protected abstract async internalDeleteAll(className: string, objects: Array<any>): Promise<boolean>;
  protected abstract async internalDeleteObject(className: string, object: any): Promise<boolean>;

  public async find(query: Query): Promise<Array<any>> {
    if (!(isAlphanumeric(query.className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, query.className);
    }

    const objects = await this.internalFind(query);
    return objects.map(obj => this.stripInternalFields(obj));
  }

  public async first(query: Query): Promise<any> {
    if (!(isAlphanumeric(query.className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, query.className);
    }

    const object = await this.internalFirst(query);
    if (object === null) {
      return null;
    }
    return this.stripInternalFields(object);
  }

  public async saveAll(
    className: string,
    objects: Array<any>,
    options: SavingOptions = { savingMode: SavingMode.Upsert }
  ): Promise<Array<any>> {
    if (!(isAlphanumeric(className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
    }

    const savedObjects = await this.internalSaveAll(className, objects, options);
    return savedObjects.map(obj => this.stripInternalFields(obj));
  }

  public async saveObject(
    className: string,
    object: any,
    options: SavingOptions = { savingMode: SavingMode.Upsert }
  ): Promise<any> {
    if (!(isAlphanumeric(className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
    }

    const savedObject = await this.internalSaveObject(className, object, options);
    return this.stripInternalFields(savedObject);
  }

  public async saveUser(
    user: HotaruUser
  ): Promise<HotaruUser> {
    const data = user._getDataStore().getRawData();
    data.__changelog = user._getDataStore().getChangelog();
    const savedUserData = await this.internalSaveObject('_User', data, { savingMode: SavingMode.UpdateOnly });
    return new HotaruUser(new UserDataStore(savedUserData, savedUserData.__changelog));
  }

  public async deleteAll(className: string, objects: Array<any>): Promise<boolean> {
    if (!(isAlphanumeric(className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
    }

    return this.internalDeleteAll(className, objects);
  }

  public async deleteObject(className: string, object: any): Promise<boolean> {
    if (!(isAlphanumeric(className))) {
      throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
    }
    
    return this.deleteAll(className, [object]);
  }
}

export default DbAdapter;
