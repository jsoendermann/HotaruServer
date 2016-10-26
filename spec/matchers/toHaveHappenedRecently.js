export default function toHaveHappenedRecently(_util, _customEqualityTesters) {
  return {
    compare(actual, secondsBeforeNowRange = 3) {
      if (!(actual instanceof Date)) {
        return {
          pass: false,
          message: `${actual} is not a date`,
        };
      }

      if (actual > new Date()) {
        return {
          pass: false,
          message: `${actual} lies in the future`,
        };
      }

      if ((new Date().getTime() / 1000) - (actual.getTime() / 1000) < secondsBeforeNowRange) {
        return {
          pass: true,
        };
      }

      return {
        pass: false,
        message: 'Did not happen recently',
      };
    },
  };
}
