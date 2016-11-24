interface Selector {
  type: string
}

interface SortOperator {
  type: string
  key: string
}

type SortValue = boolean | number | string | null | undefined;
type OrderedSortValue = number | string;

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

  equalTo(key: string, value: SortValue) {
    this.selectors.push(<Selector>{ type: 'equalTo', key, value });
  }

  notEqualTo(key: string, value: SortValue) {
    this.selectors.push(<Selector>{ type: 'notEqualTo', key, value });
  }

  lessThan(key: string, value: OrderedSortValue) {
    this.selectors.push(<Selector>{ type: 'lessThan', key, value });
  }

  lessThanOrEqual(key: string, value: OrderedSortValue) {
    this.selectors.push(<Selector>{ type: 'lessThanOrEqual', key, value });
  }

  greaterThan(key: string, value: OrderedSortValue) {
    this.selectors.push(<Selector>{ type: 'greaterThan', key, value });
  }

  greaterThanOrEqual(key: string, value: OrderedSortValue) {
    this.selectors.push(<Selector>{ type: 'greaterThanOrEqual', key, value });
  }

  containedIn(key: string, value: Array<SortValue>) {
    this.selectors.push(<Selector>{ type: 'containedIn', key, value });
  }

  notContainedIn(key: string, value: Array<SortValue>) {
    this.selectors.push(<Selector>{ type: 'notContainedIn', key, value });
  }

  mod(key: string, divisor: number, remainder: number) {
    this.selectors.push(<Selector>{ type: 'mod', key, divisor, remainder });
  }

  regex(key: string, regex: string, options: string) {
    this.selectors.push(<Selector>{ type: 'regex', key, regex, options });
  }

  where(expressionString: string) {
    this.selectors.push(<Selector>{ type: 'where', expressionString });
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
