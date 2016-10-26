export default function toBeAnAlphanumericString(_util, _customEqualityTesters) {
  return {
    compare(actual, length) {
      const isAlphanumeric = /^[a-zA-Z0-9]*$/.test(actual);

      if (!isAlphanumeric) {
        return {
          pass: false,
          message: `${actual} is not alphanumeric`,
        };
      }

      if (length === undefined) {
        return { pass: true };
      } else if (actual.length !== length) {
        return {
          pass: false,
          message: `${actual} is alphanumeric but its length is incorrect: ${actual.length} !== ${length}`,
        };
      }
      return { pass: true };
    },
  };
}
