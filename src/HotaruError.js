export default class HotaruError extends Error {
  constructor(code, message) {
    super();

    this.code = code;

    if (message) {
      this.message = message;
    } else {
      this.message = HotaruError.messageWithCode(code);
    }
  }

  static get USER_ALREADY_EXISTS() { return 100; }
  static get INVALID_EMAIL_ADDRESS() { return 101; }
  static get INVALID_PASSWORD() { return 102; }

  static get SESSION_NOT_FOUND() { return 104; }
  static get CAN_NOT_CONVERT_NON_GUEST_USER() { return 105; }
  static get CAN_NOT_SAVE_TWO_OBJECTS_WITH_SAME_ID() { return 106; }
  static get NO_USER_WITH_GIVEN_EMAIL_ADDRESS() { return 107; }
  static get INCORRECT_PASSWORD() { return 108; }
  static get LOGOUT_FAILED() { return 109; }

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
      default: return `Error ${code}`;
    }
  }
}
