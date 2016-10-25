/* global describe, it, expect */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0 */

const validateEmail = require('../../lib/utils').validateEmail;

describe('validateEmail', function () {
  it('should accept valid email addresses', function () {
    ['a@b.com', 'arst.qwfp@qwfp-arst.london', 'arst_qwfp@arst.com'].forEach(email => {
      expect(validateEmail(email)).toBeTruthy();
    });
  });

  it('should reject invalid email addresses', function () {
    ['', '@arst.com', 'arstarst', '1234@4321.1234'].forEach(invalidEmail => {
      expect(validateEmail(invalidEmail)).toBeFalsy();
    });
  });
});
