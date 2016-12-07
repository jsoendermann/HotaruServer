import { isAlphanumeric } from 'validator';
import { HotaruError, HotaruUser, SelfContainedUserDataStore, Query } from 'hotaru';
import * as winston from 'winston';

export type FieldType = 'int' | 'float' | 'string' | 'boolean' | 'array' | 'date' | 'object';

export interface FieldDescriptor {
  fieldName: string;
  type: FieldType;
  nullable?: boolean;
}

export interface ClassDescriptor {
  className: string;
  fieldDescriptors: FieldDescriptor[];
}

export type Schema = ClassDescriptor[];

export enum SavingMode {
  Upsert,
  CreateOnly,
  UpdateOnly
}

export interface SavingOptions {
  savingMode: SavingMode;
};


function verifyType(value: any, type: FieldType): boolean {
  switch (type) {
    case 'int': return Number.isInteger(value);
    case 'float': return Number.isFinite(value);
    case 'string': return typeof value === 'string';
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'date': return value instanceof Date;
    case 'object': return !(value instanceof Date) && !Array.isArray(value) && typeof value === 'object';
  }
}

function denyInternalClassAccess(klass: any, key: string, descriptor: any) {
  return {
    value: async function (className: string, ...args: any[]) {
      if (!(isAlphanumeric(className))) {
        throw new HotaruError(HotaruError.INVALID_CLASS_NAME, className);
      }

      return await descriptor.value.call(this, className, ...args);
    }
  };
}

function denyInternalClassQuery(klass: any, key: string, descriptor: any) {
  return {
    value: async function (query: Query) {
      if (!(isAlphanumeric(query.className))) {
        throw new HotaruError(HotaruError.INVALID_CLASS_NAME, query.className);
      }

      return await descriptor.value.call(this, query);
    }
  };
}

export abstract class DbAdapter {
  protected classNameToClassDescriptor: { [className: string]: ClassDescriptor};
  protected abstract async internalFind(query: Query): Promise<any[]>;
  protected abstract async internalFirst(query: Query): Promise<any>;
  protected abstract async internalSaveAll(className: string, objects: any[], options: SavingOptions): Promise<any[]>;
  protected abstract async internalSaveObject(className: string, object: any, options: SavingOptions): Promise<any>;
  protected abstract async internalDeleteAll(className: string, objects: any[]): Promise<boolean>;
  protected abstract async internalDeleteObject(className: string, object: any): Promise<boolean>;

  protected logger_: winston.LoggerInstance;

  constructor(schema: Schema) {
    if (schema) {
      schema.unshift({
        className: '_User',
        fieldDescriptors: []
      });

      schema.forEach(classDescriptor => {
        // This is nullable b/c schema gets verified before _id, createdAt & updatedAt are set
        classDescriptor.fieldDescriptors.push({ fieldName: '_id', type: 'string', nullable: true });
        classDescriptor.fieldDescriptors.push({ fieldName: 'createdAt', type: 'date', nullable: true });
        classDescriptor.fieldDescriptors.push({ fieldName: 'updatedAt', type: 'date', nullable: true });

        if (classDescriptor.className === '_User') {
          // nullable for guest users
          classDescriptor.fieldDescriptors.push({ fieldName: 'email', type: 'string', nullable: true });
        }
      });

      this.classNameToClassDescriptor = {};
      schema.forEach(classDescriptor => this.classNameToClassDescriptor[classDescriptor.className] = classDescriptor);
    }
  }

  public set logger(logger: winston.LoggerInstance) {
    this.logger_ = logger;
  }

  private ensureSchemaConformance(className: string, object: any): void {
    if (!this.classNameToClassDescriptor) {
      return;
    }

    const classDescriptor = this.classNameToClassDescriptor[className];
    
    if (!classDescriptor) {
      throw new HotaruError(HotaruError.CLASS_NOT_IN_SCHEMA, className);
    }

    const fieldNameToFieldDescriptor = {} as { [fieldName: string]: FieldDescriptor };
    classDescriptor.fieldDescriptors.forEach(fieldDescriptor =>
      fieldNameToFieldDescriptor[fieldDescriptor.fieldName] = fieldDescriptor  
    )

    const typeErrors = Object.keys(object).map(key => {
      if (key.startsWith('__')) {
        return null;
      }

      const fieldDescriptor = fieldNameToFieldDescriptor[key];
      if (!fieldDescriptor) {
        return `Field not in schema: ${key}`
      }

      const value = object[key];

      if (value === null || value === undefined) {
        // We do nullable checks below
        return null;
      }

      if (!verifyType(value, fieldDescriptor.type)) {
        return `Value ${value} of field ${key} does not conform to type ${fieldDescriptor.type}`;
      }

      return null;
    });

    const nullableErrors = classDescriptor.fieldDescriptors.map(({ fieldName, nullable }) => {
      if (nullable === false && (object[fieldName] === null || object[fieldName] === undefined)) {
        return `Field ${fieldName} is ${object[fieldName]} but is not marked as nullable`;
      }
      return null;
    });

    const errors = [...typeErrors, ...nullableErrors].filter(e => e !== null);

    if (errors.length > 0) {
      throw new HotaruError(HotaruError.SCHEMA_CONFORMANCE_ERROR, errors.join('; '));
    }
  }

  public stripInternalFields(object: any): any {
    const ret: { [attr: string]: any } = {};

    for (const attribute of Object.keys(object)) {
      if (!attribute.startsWith('__')) {
        ret[attribute] = object[attribute];
      }
    }

    return ret;
  }

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
    objects.forEach(obj => this.ensureSchemaConformance(className, obj));

    const savedObjects = await this.internalSaveAll(className, objects, options);
    return savedObjects.map(obj => this.stripInternalFields(obj));
  }

  @denyInternalClassAccess
  public async saveObject(
    className: string,
    object: any,
    options: SavingOptions = { savingMode: SavingMode.Upsert }
  ): Promise<any> {
    this.ensureSchemaConformance(className, object);

    const savedObject = await this.internalSaveObject(className, object, options);
    return this.stripInternalFields(savedObject);
  }

  public async saveUser(
    user: HotaruUser
  ): Promise<HotaruUser> {
    const data = user._getDataStore().getRawData() as any;
    data.__changelog = user._getDataStore().getChangelog();

    this.ensureSchemaConformance('_User', data);

    const savedUserData = await this.internalSaveObject('_User', data, { savingMode: SavingMode.UpdateOnly });
    return new HotaruUser(new SelfContainedUserDataStore(savedUserData, savedUserData.__changelog));
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
