/* global describe, it, expect, beforeEach, jasmine */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';
import toHaveHappenedRecently from './toHaveHappenedRecently';

install();


describe('toHaveHappenedRecently', async function () {
  beforeEach(async function () {
    jasmine.addMatchers({ toHaveHappenedRecently });
  });

  it('should accept recent dates', async function () {
    expect(new Date()).toHaveHappenedRecently();
  });

  it("should accept dates that didn't happen in the recent past", async function () {
    expect(0).not.toHaveHappenedRecently();
    expect(new Date(0)).not.toHaveHappenedRecently();
    expect(new Date('1 Jan 2039')).not.toHaveHappenedRecently();
  });
});
