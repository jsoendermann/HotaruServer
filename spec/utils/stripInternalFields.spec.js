/* global describe, it, expect */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0 */

const stripInternalFields = require('../../lib/utils').stripInternalFields;

describe('stripInternalFields', function () {
  it('should strip internal fields', function () {
    const objects = [
      [
        { a: 1 }, { a: 1 },
      ],
      [
        { a: 1, __b: 2 }, { a: 1 },
      ],
      [
        { __b: 2 }, {},
      ],
      [
        { __: 1 }, {},
      ],
    ];

    objects.forEach(([org, stripped]) =>
      expect(stripInternalFields(org)).toEqual(stripped)
    );
  });
});
