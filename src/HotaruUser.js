import HotaruError from './HotaruError';
import { freshId, isAlphanum, stripInternalFields } from './utils';

export default class HotaruUser {
  constructor(data) {
    this._data = data;
    if (!Array.isArray(this._data.__changelog)) {
      this._data.__changelog = [];
    }
  }

  _getRawData() {
    return this._data;
  }

  _getStrippedRawData() {
    return stripInternalFields(this._data);
  }

  get(field) {
    if (!isAlphanum(field) && field !== '_id') {
      throw new HotaruError(HotaruError.INVALID_FIELD_NAME, field);
    }

    return this._data[field];
  }

  set(field, value) {
    if (!isAlphanum(field)) {
      throw new HotaruError(HotaruError.INVALID_FIELD_NAME, field);
    }

    this._data[field] = value;

    this._data.__changelog = this._data.__changelog.filter(e => e.field !== field);

    this._data.__changelog.push({
      _id: freshId(),
      date: new Date(),
      type: 'set',
      field,
      value,
    });
  }

  _setHashedPassword(hashedPassword) {
    this._data.__hashedPassword = hashedPassword;
  }

  increment(field, value = 1) {
    if (!isAlphanum(field)) {
      throw new HotaruError(HotaruError.INVALID_FIELD_NAME, field);
    }

    if (this._data[field] === undefined) {
      this._data[field] = 0;
    }
    if (typeof this._data[field] !== 'number') {
      throw new Error(`Can only increment number fields, ${field} is of type ${typeof this._data[field]}`);
    }

    this._data[field] += value;

    this._data.__changelog.push({
      _id: freshId(),
      date: new Date(),
      type: 'increment',
      field,
      value,
    });
  }

  decrement(field, value = 1) {
    this.increment(field, -value);
  }

  append(field, value) {
    if (!isAlphanum(field)) {
      throw new HotaruError(HotaruError.INVALID_FIELD_NAME, field);
    }

    if (this._data[field] === undefined) {
      this._data[field] = [];
    }
    if (!Array.isArray(this._data[field])) {
      throw new Error(`Can only append to arrays, ${field} is of type ${typeof this._data[field]}`);
    }

    this._data[field].push(value);

    this._data.__changelog.push({
      _id: freshId(),
      date: new Date(),
      type: 'append',
      field,
      value,
    });
  }

  isGuest() {
    return this._data.email === null;
  }
}
