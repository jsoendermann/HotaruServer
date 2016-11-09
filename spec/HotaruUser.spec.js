/* global jasmine, beforeAll, describe, it, expect */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import toBeAnAlphanumericString from 'to-be-an-alphanumeric-string';

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

  const s = changelog => changelog.map(entry => ({
    type: entry.type,
    field: entry.field,
    value: entry.value,
  }));

  it('should keep a changelog', () => {
    const user = new HotaruUser({ a: 1, b: [] });
    user.set('a', 2);

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

    expect(s(user._data.__changelog)).toEqual([
      { type: 'set', field: 'b', value: 'bla' },
      { type: 'set', field: 'a', value: 3 },
    ]);
  });

  it('should overwrite local vars when client set a newer value', () => {
    const user = new HotaruUser({});
    user.set('a', 1);

    const clientChangelog = [
      {
        date: new Date('2039-01-01'),
        type: 'set',
        field: 'a',
        value: 2,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual(2);
  });

  it('should not overwrite local values when the value set on the client is older', () => {
    const user = new HotaruUser({});
    user.set('a', 1);

    const clientChangelog = [
      {
        date: new Date('1900-01-01'),
        type: 'set',
        field: 'a',
        value: 2,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual(1);
  });

  it('should create numbers when they get incremented on the client', () => {
    const user = new HotaruUser({});
    const clientChangelog = [
      {
        date: new Date('1900-01-01'),
        type: 'increment',
        field: 'a',
        value: 42,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual(42);
  });

  it('should create arrays when they are appended to on the client', () => {
    const user = new HotaruUser({});
    const clientChangelog = [
      {
        date: new Date('1900-01-01'),
        type: 'append',
        field: 'a',
        value: 42,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual([42]);
  });

  it('should merge increments', () => {
    const user = new HotaruUser({});
    user.increment('a', 21);
    const clientChangelog = [
      {
        date: new Date('1900-01-01'),
        type: 'increment',
        field: 'a',
        value: 21,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual(42);
  });

  it('should merge appends', () => {
    const user = new HotaruUser({});
    user.append('a', 21);
    const clientChangelog = [
      {
        date: new Date('1900-01-01'),
        type: 'append',
        field: 'a',
        value: 21,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual([21, 21]);
  });

  it('should preperly merge if we increment and the client set the value before the increment', () => {
    const user = new HotaruUser({});
    user.increment('a', 1);

    expect(user.get('a')).toEqual(1);

    const clientChangelog = [
      {
        date: new Date('1900-01-01'),
        type: 'set',
        field: 'a',
        value: 10,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual(11);
  });

  it('should overwrite client increments if we set the value later', () => {
    const user = new HotaruUser({});
    user.set('a', 42);

    const clientChangelog = [
      {
        date: new Date('1900-01-01'),
        type: 'increment',
        field: 'a',
        value: 10,
      },
    ];

    user._mergeChangelog(clientChangelog);

    expect(user.get('a')).toEqual(42);
  });
});
