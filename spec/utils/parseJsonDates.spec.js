/* global describe, it, expect */
/* eslint prefer-arrow-callback:0, func-names:0, global-require:0, import/no-extraneous-dependencies:0 */

import install from 'jasmine-es6';

install();


describe('parseJsonDates', function () {
  const parseJsonDates = require('../../lib/utils').parseJsonDates;


  it('should handle empty objects', () => {
    const obj = {};
    const processedObj = JSON.parse(JSON.stringify(obj));
    const originalObj = parseJsonDates(processedObj);
    expect(obj).toEqual(originalObj);
  });

  it('should parse json dates', () => {
    const obj = { a: new Date() };
    const processedObj = JSON.parse(JSON.stringify(obj));
    const originalObj = parseJsonDates(processedObj);
    expect(obj).not.toEqual(processedObj);
    expect(obj).toEqual(originalObj);
  });

  it('should handle nested objects', () => {
    const obj = { a: { b: { c: new Date() } } };
    const processedObj = JSON.parse(JSON.stringify(obj));
    const originalObj = parseJsonDates(processedObj);
    expect(obj).not.toEqual(processedObj);
    expect(obj).toEqual(originalObj);
  });

  it('should play nice with other values', () => {
    const obj = { a: null, b: [], c: 0, d: '', e: [], f: new Date() };
    const processedObj = JSON.parse(JSON.stringify(obj));
    const originalObj = parseJsonDates(processedObj);
    expect(obj).not.toEqual(processedObj);
    expect(obj).toEqual(originalObj);
  });
});
