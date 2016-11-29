type PrimitiveValue = boolean | number | string;
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
  value: PrimitiveValue[];
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

export type Selector = EqualitySelector | ComparisonSelector | ContainmentSelector | ModSelector | RegexSelector | WhereSelector;

export interface SortOperator {
  type: 'ascending' | 'descending';
  key: string
}


export class Query {
  private className_: string;
  private selectors_: Selector[];
  private sortOperators_: SortOperator[];
  private limit_?: number;
  private skip_?: number;
  

  constructor(className: string) {
    this.className_ = className;
    this.selectors_ = [];
    this.sortOperators_ = [];
    this.limit_ = null;
    this.skip_ = null;
  }


  get className(): string {
    return this.className_;
  }


  equalTo(key: string, value: PrimitiveValue) {
    this.selectors_.push({ type: 'equalTo', key, value });
  }

  notEqualTo(key: string, value: PrimitiveValue) {
    this.selectors_.push({ type: 'notEqualTo', key, value });
  }

  lessThan(key: string, value: OrderedPrimitiveValue) {
    this.selectors_.push({ type: 'lessThan', key, value });
  }

  lessThanOrEqual(key: string, value: OrderedPrimitiveValue) {
    this.selectors_.push({ type: 'lessThanOrEqual', key, value });
  }

  greaterThan(key: string, value: OrderedPrimitiveValue) {
    this.selectors_.push({ type: 'greaterThan', key, value });
  }

  greaterThanOrEqual(key: string, value: OrderedPrimitiveValue) {
    this.selectors_.push({ type: 'greaterThanOrEqual', key, value });
  }

  containedIn(key: string, value: Array<PrimitiveValue>) {
    this.selectors_.push({ type: 'containedIn', key, value });
  }

  notContainedIn(key: string, value: Array<PrimitiveValue>) {
    this.selectors_.push({ type: 'notContainedIn', key, value });
  }

  mod(key: string, divisor: number, remainder: number) {
    this.selectors_.push({ type: 'mod', key, divisor, remainder });
  }

  regex(key: string, regex: string, options: string) {
    this.selectors_.push({ type: 'regex', key, regex, options });
  }

  where(expressionString: string) {
    this.selectors_.push({ type: 'where', expressionString });
  }

  get selectors(): Selector[] {
    return this.selectors_;
  } 


  ascending(key: string) {
    this.sortOperators_.push({ type: 'ascending', key });
  }

  descending(key: string) {
    this.sortOperators_.push({ type: 'descending', key });
  }

  get sortOperators(): SortOperator[] {
    return this.sortOperators_;
  }


  get limit(): number {
    return this.limit_;
  }

  set limit(limit: number) {
    this.limit_ = limit;
  }

  get skip(): number {
    return this.skip_;
  }

  set skip(skip: number) {
    this.skip_ = skip;
  }
}
