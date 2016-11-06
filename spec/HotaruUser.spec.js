/* global jasmine, beforeAll, describe, it, expect */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import toBeAnAlphanumericString from './matchers/toBeAnAlphanumericString';

install();


describe('HotaruUser', function () {
  const HotaruUser = require('../lib/HotaruUser').default;
  const HotaruError = require('../lib/HotaruError').default;

  beforeAll(async function () {
    jasmine.addMatchers({ toBeAnAlphanumericString });
  });

  it('should create a changelog if non exists', () => {
    const user = new HotaruUser({ a: 42 });
    expect(user._getRawData()).toEqual({ a: 42, __changelog: [] });
  });

  it('should strip internal fields when _getStrippedRawData is called', () => {
    const user = new HotaruUser({ __a: 42 });
    user.set('b', 2);

    expect(user._getStrippedRawData()).toEqual({ b: 2 });
  });

  it('should return fields with get', () => {
    const user = new HotaruUser({ a: 42 });
    expect(user.get('a')).toEqual(42);
  });

  it('should not reveal internal fields when get is called', () => {
    const user = new HotaruUser({ a: 42, __b: 1 });
    try {
      user.get('__b');
    } catch (error) {
      expect(error.code).toEqual(HotaruError.INVALID_FIELD_NAME);
    }
  });

  it('should allow getting _id', () => {
    const user = new HotaruUser({ _id: 'bla', a: 1 });
    expect(user.get('_id')).toEqual('bla');
  });

  it('should set', () => {
    const user = new HotaruUser({ a: 1 });
    user.set('a', 2);
    user.set('b', 3);
    expect(user.get('a')).toEqual(2);
    expect(user.get('b')).toEqual(3);
  });

  it('should not allow setting _id', () => {
    const user = new HotaruUser({ _id: 'bla' });
    try {
      user.set('_id', 'foo');
    } catch (error) {
      expect(error.code).toEqual(HotaruError.INVALID_FIELD_NAME);
    }
  });

  it('sholud increment and decrement fields', () => {
    const user = new HotaruUser({ a: 1, b: 10 });
    user.increment('a', 1);
    user.decrement('b', 2);
    user.increment('c');
    expect(user.get('a')).toEqual(2);
    expect(user.get('b')).toEqual(8);
    expect(user.get('c')).toEqual(1);
  });

  it('should append', () => {
    const user = new HotaruUser({ a: [] });
    user.append('a', 1);
    user.append('b', 2);
    expect(user.get('a')).toEqual([1]);
    expect(user.get('b')).toEqual([2]);
  });

  it('should keep a changelog', () => {
    const s = changelog => changelog.map(entry => ({
      type: entry.type,
      field: entry.field,
      value: entry.value,
    }));

    const user = new HotaruUser({ a: 1, b: [] });
    user.set('a', 2);

    expect(user._data.__changelog[0]._id).toBeAnAlphanumericString(15);
    expect(s(user._data.__changelog)).toEqual([
      { type: 'set', field: 'a', value: 2 },
    ]);

    user.increment('a');

    expect(s(user._data.__changelog)).toEqual([
      { type: 'set', field: 'a', value: 2 },
      { type: 'increment', field: 'a', value: 1 },
    ]);

    user.set('b', 'bla');

    expect(s(user._data.__changelog)).toEqual([
      { type: 'set', field: 'a', value: 2 },
      { type: 'increment', field: 'a', value: 1 },
      { type: 'set', field: 'b', value: 'bla' },
    ]);

    user.set('a', 3);

    expect(user._data.__changelog[0]._id).toBeAnAlphanumericString(15);
    expect(s(user._data.__changelog)).toEqual([
      { type: 'set', field: 'b', value: 'bla' },
      { type: 'set', field: 'a', value: 3 },
    ]);
  });

  // changelog
});
