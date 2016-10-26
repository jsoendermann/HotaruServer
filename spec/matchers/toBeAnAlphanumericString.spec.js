/* global describe, it, expect, beforeEach, jasmine */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import toBeAnAlphanumericString from './toBeAnAlphanumericString';

install();


describe('toBeAnAlphanumericString', async function () {
  beforeEach(async function () {
    jasmine.addMatchers({ toBeAnAlphanumericString });
  });

  it('should validate alphanumeric strings', async function () {
    expect('').toBeAnAlphanumericString();
    expect('arst').toBeAnAlphanumericString();
    expect('123').toBeAnAlphanumericString();
    expect('a1rs2t').toBeAnAlphanumericString();
    expect('').toBeAnAlphanumericString(0);
    expect('arst').toBeAnAlphanumericString(4);
  });

  it('should reject non-alphanumeric strings or strings of incorrect length', async function () {
    expect('_').not.toBeAnAlphanumericString();
    expect('_User').not.toBeAnAlphanumericString();
    expect('_$_').not.toBeAnAlphanumericString();
    expect('哈罗').not.toBeAnAlphanumericString();
    expect('arst').not.toBeAnAlphanumericString(5);
  });
});
