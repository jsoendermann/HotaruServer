/* global describe, it, expect */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';

install();


describe('isAlphanum', function () {
  const isAlphanum = require('../../lib/utils').isAlphanum;


  it('should accept alphanumeric strings', function () {
    expect(isAlphanum('')).toBeTruthy();
    expect(isAlphanum('arst')).toBeTruthy();
    expect(isAlphanum('0123')).toBeTruthy();
    expect(isAlphanum('A1A2')).toBeTruthy();
  });

  it('should not accept non-alphanumeric strings', function () {
    expect(isAlphanum('_')).toBeFalsy();
    expect(isAlphanum('_User')).toBeFalsy();
    expect(isAlphanum('U_ser')).toBeFalsy();
    expect(isAlphanum('User$')).toBeFalsy();
  });
});
