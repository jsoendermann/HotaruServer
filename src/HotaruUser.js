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
      date: new Date(),
      type: 'append',
      field,
      value,
    });
  }

  isGuest() {
    return this._data.email === null;
  }

  _mergeChangelog(clientChangelog) {
    const sortedClientChangelog = clientChangelog.sort((a, b) => a.date - b.date);
    sortedClientChangelog.forEach(change => {
      switch (change.type) {
        case 'set':
          {
            const existingNewerSet = this._data.__changelog.find(c =>
              c.type === 'set' && c.date > change.date && c.field === change.field
            );
            if (existingNewerSet === undefined) {
              this._data.__changelog = this._data.__changelog.filter(c => c.field !== change.field || c.date > change.date);
              const laterLocalIncrementsAndAppends = this._data.__changelog.filter(c => c.field === change.field);
              this._data[change.field] = change.value;
              laterLocalIncrementsAndAppends.forEach(c => {
                if (c.type === 'increment') {
                  this._data[change.field] += c.value;
                } else if (c.type === 'append') {
                  this._data[change.field].append(c.value);
                } else {
                  throw new HotaruError(HotaruError.INVALID_CHANGE_TYPE);
                }
              });
              this._data.__changelog.push(change);
            }
          }
          break;
        case 'increment':
          {
            const existingNewerSet = this._data.__changelog.find(c =>
              c.type === 'set' && c.date > change.date && c.field === change.field
            );
            if (existingNewerSet === undefined) {
              if (this._data[change.field] === undefined) {
                this._data[change.field] = 0;
              }
              this._data[change.field] += change.value;
              this._data.__changelog.push(change);
            }
          }
          break;
        case 'append':
          {
            const existingNewerSet = this._data.__changelog.find(c =>
              c.type === 'set' && c.date > change.date && c.field === change.field
            );
            if (existingNewerSet === undefined) {
              if (this._data[change.field] === undefined) {
                this._data[change.field] = [];
              }
              this._data[change.field].push(change.value);
              this._data.__changelog.push(change);
            }
          }
          break;
        default: throw new HotaruError(HotaruError.INVALID_CHANGE_TYPE, change.type);
      }
    });

    // We append new changes at the end in the loop above even if they should be placed
    // somewhere in the middle
    this._data.__changelog.sort((a, b) => a.date - b.date);
  }
}
