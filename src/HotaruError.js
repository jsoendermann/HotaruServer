export default class HotaruError extends Error {
  constructor(code, description) {
    let message = '';

    if (description) {
      message = `${HotaruError.messageWithCode(code)} (${description})`;
    } else {
      message = HotaruError.messageWithCode(code);
    }

    super(message);

    this.code = code;
  }

  static get USER_ALREADY_EXISTS() { return 100; }
  static get INVALID_EMAIL_ADDRESS() { return 101; }
  static get INVALID_PASSWORD() { return 102; }
  static get SESSION_NOT_FOUND() { return 103; }
  static get CAN_NOT_CONVERT_NON_GUEST_USER() { return 104; }
  static get CAN_NOT_SAVE_TWO_OBJECTS_WITH_SAME_ID() { return 105; }
  static get NO_USER_WITH_GIVEN_EMAIL_ADDRESS() { return 106; }
  static get INCORRECT_PASSWORD() { return 107; }
  static get LOGOUT_FAILED() { return 108; }
  static get INVALID_CLASS_NAME() { return 109; }
  static get UNKNOWN_SAVING_MODE() { return 110; }
  static get OBJECT_WITHOUT_ID_IN_UPDATE_ONLY_SAVING_MODE() { return 111; }
  static get CAN_NOT_OVERWRITE_OBJECT_IN_CREATE_ONLY_SAVING_MODE() { return 112; }
  static get CAN_NOT_CREATE_NEW_OBJECT_IN_UPDATE_ONLY_SAVING_MODE() { return 113; }
  static get UNKNOWN_QUERY_SELECTOR() { return 114; }
  static get UNKNOWN_SORT_OPERATOR() { return 115; }
  static get CAN_NOT_DELETE_OBJECT_WITHOUT_ID() { return 116; }
  static get CAN_NOT_DELETE_TWO_OBJECTS_WITH_SAME_ID() { return 117; }
  static get CLOUD_FUNCTION_NAMES_MUST_BE_ALPHANUMERIC() { return 118; }
  static get NOT_LOGGED_IN() { return 119; }
  static get INVALID_FIELD_NAME() { return 120; }
  static get INVALID_CHANGE_TYPE() { return 121; }

  static messageWithCode(code) {
    switch (code) {
      case HotaruError.USER_ALREADY_EXISTS: return 'User already exists';
      case HotaruError.INVALID_EMAIL_ADDRESS: return 'Invalid email address';
      case HotaruError.INVALID_PASSWORD: return 'Invalid password';
      case HotaruError.SESSION_NOT_FOUND: return 'Session not found';
      case HotaruError.CAN_NOT_CONVERT_NON_GUEST_USER: return 'Can not convert non guest user';
      case HotaruError.CAN_NOT_SAVE_TWO_OBJECTS_WITH_SAME_ID: return 'Can not save two objects with the same _id';
      case HotaruError.NO_USER_WITH_GIVEN_EMAIL_ADDRESS: return 'No user with given email address';
      case HotaruError.INCORRECT_PASSWORD: return 'Incorrect password';
      case HotaruError.LOGOUT_FAILED: return 'Logout failed';
      case HotaruError.INVALID_CLASS_NAME: return 'Invalid class name';
      case HotaruError.UNKNOWN_SAVING_MODE: return 'Unknown saving mode';
      case HotaruError.OBJECT_WITHOUT_ID_IN_UPDATE_ONLY_SAVING_MODE:
        return 'Object without _id in UPDATE_ONLY savingMode';
      case HotaruError.CAN_NOT_OVERWRITE_OBJECT_IN_CREATE_ONLY_SAVING_MODE:
        return 'Can not overwrite object in CREATE_ONLY savingMode';
      case HotaruError.CAN_NOT_CREATE_NEW_OBJECT_IN_UPDATE_ONLY_SAVING_MODE:
        return 'Can not create new objet in UPDATE_ONLY savingMode';
      case HotaruError.UNKNOWN_QUERY_SELECTOR: return 'Unknown query selector';
      case HotaruError.UNKNOWN_SORT_OPERATOR: return 'Unknown sort operator';
      case HotaruError.CAN_NOT_DELETE_OBJECT_WITHOUT_ID:
        return 'Can not delete object without _id';
      case HotaruError.CAN_NOT_DELETE_TWO_OBJECTS_WITH_SAME_ID:
        return 'Can not delete two objects with the same _id';
      case HotaruError.CLOUD_FUNCTION_NAMES_MUST_BE_ALPHANUMERIC:
        return 'Cloud function names must be alphanumeric';
      case HotaruError.NOT_LOGGED_IN: return 'Not logged in';
      case HotaruError.INVALID_FIELD_NAME: return 'Invalid field name';
      case HotaruError.INVALID_CHANGE_TYPE: return 'Invalid change type';
      default: return `Error ${code}`;
    }
  }
}
