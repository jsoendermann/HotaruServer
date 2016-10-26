export default class HotaruError extends Error {
  constructor(code, description) {
    super();

    this.code = code;

    if (description) {
      this.message = `${HotaruError.messageWithCode(code)} (${description})`;
    } else {
      this.message = HotaruError.messageWithCode(code);
    }
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
      default: return `Error ${code}`;
    }
  }
}
