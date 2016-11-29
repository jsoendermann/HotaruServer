import { Query } from '../Query';
import DbAdapter from './DbAdapter';
import SavingOptions from '../SavingOptions';

abstract class InternalDbAdapter extends DbAdapter {
  public abstract async internalFind(query: Query): Promise<any[]>;
  public abstract async internalFirst(query: Query): Promise<any>;
  public abstract async internalSaveAll(className: string, objects: any[], options: SavingOptions): Promise<any[]>;
  public abstract async internalSaveObject(className: string, object: any, options: SavingOptions): Promise<any>;
  public abstract async internalDeleteAll(className: string, objects: any[]): Promise<boolean>;
  public abstract async internalDeleteObject(className: string, object: any): Promise<boolean>;
}

export default InternalDbAdapter;