export default class Query {
  constructor(className) {
    this._className = className;
    this._selectors = [];
    this._sortOperators = [];
    this._limit = null;
    this._skip = null;
  }

  equalTo(key, value) {
    this._selectors.push({ type: 'equalTo', key, value });
  }

  notEqualTo(key, value) {
    this._selectors.push({ type: 'notEqualTo', key, value });
  }

  lessThan(key, value) {
    this._selectors.push({ type: 'lessThan', key, value });
  }

  lessThanOrEqual(key, value) {
    this._selectors.push({ type: 'lessThanOrEqual', key, value });
  }

  greaterThan(key, value) {
    this._selectors.push({ type: 'greaterThan', key, value });
  }

  greaterThanOrEqual(key, value) {
    this._selectors.push({ type: 'greaterThanOrEqual', key, value });
  }

  containedIn(key, value) {
    this._selectors.push({ type: 'containedIn', key, value });
  }

  notContainedIn(key, value) {
    this._selectors.push({ type: 'notContainedIn', key, value });
  }

  mod(key, divisor, remainder) {
    this._selectors.push({ type: 'mod', key, divisor, remainder });
  }

  regex(key, regex, options) {
    this._selectors.push({ type: 'regex', key, regex, options });
  }

  where(expressionString) {
    this._selectors.push({ type: 'where', expressionString });
  }


  ascending(key) {
    this._sortOperators.push({ type: 'ascending', key });
  }

  descending(key) {
    this._sortOperators.push({ type: 'descending', key });
  }


  limit(limit) {
    this._limit = limit;
  }

  skip(skip) {
    this._skip = skip;
  }
}
