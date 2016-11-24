export default function stripInternalFields(obj: Object): Object {  // eslint-disable-line import/prefer-default-export
  const ret = {};

  for (const attribute of Object.keys(obj)) {
    if (!attribute.startsWith('__')) {
      ret[attribute] = obj[attribute];
    }
  }

  return ret;
}