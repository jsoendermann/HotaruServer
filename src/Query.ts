type PrimitiveValue = boolean | number | string | null | undefined;
type OrderedPrimitiveValue = number | string;

interface EqualitySelector {
  type: 'equalTo' | 'notEqualTo';
  key: string;
  value: PrimitiveValue;
}

interface ComparisonSelector {
  type: 'lessThan' | 'lessThanOrEqual' | 'greaterThan' | 'greaterThanOrEqual';
  key: string;
  value: OrderedPrimitiveValue;
}

interface ContainmentSelector {
  type: 'containedIn' | 'notContainedIn';
  key: string;
  value: Array<PrimitiveValue>;
}

interface ModSelector {
  type: 'mod';
  key: string;
  divisor: number;
  remainder: number;
}

interface RegexSelector {
  type: 'regex';
  key: string;
  regex: string;
  options: string;
}

interface WhereSelector {
  type: 'where';
  expressionString: string;
}

type Selector = EqualitySelector | ComparisonSelector | ContainmentSelector | ModSelector | RegexSelector | WhereSelector;

interface SortOperator {
  type: string
  key: string
}


export default class Query {
  private className: string;
  private selectors: Selector[];
  private sortOperators: SortOperator[];
  private limit_?: number;
  private skip_?: number;

  constructor(className: string) {
    this.className = className;
    this.selectors = [];
    this.sortOperators = [];
    this.limit = null;
    this.skip = null;
  }

  equalTo(key: string, value: PrimitiveValue) {
    this.selectors.push({ type: 'equalTo', key, value });
  }

  notEqualTo(key: string, value: PrimitiveValue) {
    this.selectors.push({ type: 'notEqualTo', key, value });
  }

  lessThan(key: string, value: OrderedPrimitiveValue) {
    this.selectors.push({ type: 'lessThan', key, value });
  }

  lessThanOrEqual(key: string, value: OrderedPrimitiveValue) {
    this.selectors.push({ type: 'lessThanOrEqual', key, value });
  }

  greaterThan(key: string, value: OrderedPrimitiveValue) {
    this.selectors.push({ type: 'greaterThan', key, value });
  }

  greaterThanOrEqual(key: string, value: OrderedPrimitiveValue) {
    this.selectors.push({ type: 'greaterThanOrEqual', key, value });
  }

  containedIn(key: string, value: Array<PrimitiveValue>) {
    this.selectors.push({ type: 'containedIn', key, value });
  }

  notContainedIn(key: string, value: Array<PrimitiveValue>) {
    this.selectors.push({ type: 'notContainedIn', key, value });
  }

  mod(key: string, divisor: number, remainder: number) {
    this.selectors.push({ type: 'mod', key, divisor, remainder });
  }

  regex(key: string, regex: string, options: string) {
    this.selectors.push({ type: 'regex', key, regex, options });
  }

  where(expressionString: string) {
    this.selectors.push({ type: 'where', expressionString });
  }


  ascending(key: string) {
    this.sortOperators.push({ type: 'ascending', key });
  }

  descending(key: string) {
    this.sortOperators.push({ type: 'descending', key });
  }


  limit(limit: number) {
    this.limit_ = limit;
  }

  skip(skip: number) {
    this.skip_ = skip;
  }
}
