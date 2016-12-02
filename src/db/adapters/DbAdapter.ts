import { Query } from '../Query';
import { isAlphanumeric } from 'validator';
import { HotaruError, HotaruUser, UserDataStore } from 'hotaru';
import SavingOptions from '../SavingOptions';
import SavingMode from '../SavingMode';

function denyInternalClassAccess(klass: any, key: string, descriptor: any) {
  return {
    value: async function (className: string, ...args: any[]) {
      if (!(isAlphanumeric(className))) {
        throw new HotaruError('INVALID_CLASS_NAME', className);
      }

      return await descriptor.value.call(this, className, ...args);
    }
  };
}

function denyInternalClassQuery(klass: any, key: string, descriptor: any) {
  return {
    value: async function (query: Query) {
      if (!(isAlphanumeric(query.className))) {
        throw new HotaruError('INVALID_CLASS_NAME', query.className);
      }

      return await descriptor.value.call(this, query);
    }
  };
}

abstract class DbAdapter {
  protected abstract stripInternalFields(object: any): any;

  protected abstract async internalFind(query: Query): Promise<any[]>;
  protected abstract async internalFirst(query: Query): Promise<any>;
  protected abstract async internalSaveAll(className: string, objects: any[], options: SavingOptions): Promise<any[]>;
  protected abstract async internalSaveObject(className: string, object: any, options: SavingOptions): Promise<any>;
  protected abstract async internalDeleteAll(className: string, objects: any[]): Promise<boolean>;
  protected abstract async internalDeleteObject(className: string, object: any): Promise<boolean>;

  @denyInternalClassQuery
  public async find(query: Query): Promise<any[]> {
    const objects = await this.internalFind(query);
    return objects.map(obj => this.stripInternalFields(obj));
  }

  @denyInternalClassQuery
  public async first(query: Query): Promise<any> {
    const object = await this.internalFirst(query);
    if (object === null) {
      return null;
    }
    return this.stripInternalFields(object);
  }

  @denyInternalClassAccess
  public async saveAll(
    className: string,
    objects: any[],
    options: SavingOptions = { savingMode: SavingMode.Upsert }
  ): Promise<any[]> {
    const savedObjects = await this.internalSaveAll(className, objects, options);
    return savedObjects.map(obj => this.stripInternalFields(obj));
  }

  @denyInternalClassAccess
  public async saveObject(
    className: string,
    object: any,
    options: SavingOptions = { savingMode: SavingMode.Upsert }
  ): Promise<any> {
    const savedObject = await this.internalSaveObject(className, object, options);
    return this.stripInternalFields(savedObject);
  }

  public async saveUser(
    user: HotaruUser
  ): Promise<HotaruUser> {
    const data = user._getDataStore().getRawData() as any;
    data.__changelog = user._getDataStore().getChangelog();
    const savedUserData = await this.internalSaveObject('_User', data, { savingMode: SavingMode.UpdateOnly });
    return new HotaruUser(new UserDataStore(savedUserData, savedUserData.__changelog));
  }

  @denyInternalClassAccess
  public async deleteAll(className: string, objects: any[]): Promise<boolean> {
    return this.internalDeleteAll(className, objects);
  }

  @denyInternalClassAccess
  public async deleteObject(className: string, object: any): Promise<boolean> {
    return this.deleteAll(className, [object]);
  }
}

export default DbAdapter;
