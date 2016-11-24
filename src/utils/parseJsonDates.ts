import * as _ from 'lodash';

const iso8601DatesRegex = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;

function isISO8601DateString(str: string): boolean {
  return iso8601DatesRegex.test(str);
}

function convertValue(value) {
  if (typeof value === 'string' && isISO8601DateString(value)) {
    return new Date(value);
  }
  return value;
}

function convertObject(obj) {
  for (const attr of Object.keys(obj)) {
    if (obj[attr] !== null && typeof obj[attr] === 'object') {
      obj[attr] = convertObject(obj[attr]);
    } else {
      obj[attr] = convertValue(obj[attr]);
    }
  }
  return obj;
}

export default function parseJsonDates(objOrg) {
  const obj = _.cloneDeep(objOrg);
  convertObject(obj);
  return obj;
}

