import * as Koa from 'koa'
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser'

import { hashSync, compareSync } from 'bcryptjs';
import { isAlphanumeric, isEmail } from 'validator';
import defaultdict from 'defaultdict-proxy';

import { HotaruError, Query } from 'hotaru'
import freshId from 'fresh-id';
;
import * as winston from 'winston';

import { DbAdapter, SavingMode } from '../db/DbAdapter';
import { InternalDbAdapter } from '../db/InternalDbAdapter';
import { MongoAdapter } from '../db/MongoAdapter';
import {
  loggingMiddleware,
  setHeaderMiddleware,
  errorHandlingMiddleware,
  dateAwareJsonHandlingMiddleware,
  sessionHandlingMiddleware,
} from './middlewares'


export type PasswordValidationFunction = (password: string) => boolean
export interface ConstructorParameters {
  prefix: string
  dbAdapter: InternalDbAdapter
  // cloudFunctionRecords: CloudFunctionRecord[];
  validatePassword: PasswordValidationFunction
  verboseLogging: boolean
  masterKey?: string
}





const freshUserObject = (email?: string, hashedPassword?: string) => {
  const now = new Date()

  return {
    email,
    __hashedPassword: hashedPassword,
    __changelog: [] as any,
    createdAt: now,
    updatedAt: now,
  }
}

const signUp = (dbAdapter: InternalDbAdapter, validatePassword: PasswordValidationFunction) => async (ctx: Koa.Context) => {
  const { email, password } = ctx.payload;

  if (!isEmail(email)) {
    throw new HotaruError(HotaruError.INVALID_EMAIL_ADDRESS);
  }

  if (!validatePassword(password)) {
    throw new HotaruError(HotaruError.INVALID_PASSWORD);
  }

  const existingUserQuery = new Query('_User');
  existingUserQuery.equalTo('email', email);
  const existingUser = await dbAdapter.internalFirst(existingUserQuery);

  if (existingUser !== null) {
    throw new HotaruError(HotaruError.USER_ALREADY_EXISTS);
  }

  const hashedPassword = hashSync(password, 10);

  const newInternalUser = await dbAdapter.internalSaveObject(
    '_User',
    freshUserObject(email, hashedPassword),
    { savingMode: SavingMode.CreateOnly }
  );

  // TODO If creating the session fails, we should delete the user and return an error
  const newSession = await dbAdapter.internalSaveObject(
    '_Session',
    {
      _id: freshId(32),
      userId: newInternalUser._id,
      createdAt: new Date(),
      expiresAt: new Date('Jan 1, 2039'),
      // TODO installationId
    },
    { savingMode: SavingMode.CreateOnly }
  );

  const newUserData = dbAdapter.stripInternalFields(newInternalUser);
  ctx.result = { sessionId: newSession._id, userData: newUserData };
}

const logIn = (dbAdapter: InternalDbAdapter) => async (ctx: Koa.Context) => {
  const { email, password } = ctx.payload;

  const userQuery = new Query('_User');
  userQuery.equalTo('email', email);
  const internalUserData = await dbAdapter.internalFirst(userQuery);

  if (internalUserData === null) {
    throw new HotaruError(HotaruError.NO_USER_WITH_GIVEN_EMAIL_ADDRESS);
  }

  if (!compareSync(password, internalUserData.__hashedPassword)) {
    throw new HotaruError(HotaruError.INCORRECT_PASSWORD);
  }

  const newSession = await dbAdapter.internalSaveObject(
    '_Session',
    {
      _id: freshId(32),
      userId: internalUserData._id,
      createdAt: new Date(),
      expiresAt: new Date('Nov 2, 2089'),
      // TODO installationId
    },
    { savingMode: SavingMode.CreateOnly }
  );
  const strippedUserData = dbAdapter.stripInternalFields(internalUserData);

  ctx.result = { sessionId: newSession._id, userData: strippedUserData };
}

const logOut = (dbAdapter: InternalDbAdapter) => async (ctx: Koa.Context) => {
  const sessionId = ctx.payload.sessionId

  if (!sessionId) {
    // TODO
    throw new Error()
  }

  const sessionQuery = new Query('_Session');
  sessionQuery.equalTo('_id', sessionId);
  const session = await dbAdapter.internalFirst(sessionQuery);

  if (session === null) {
    throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
  }

  const success = await dbAdapter.internalDeleteObject('_Session', session);

  if (!success) {
    throw new HotaruError(HotaruError.LOGOUT_FAILED);
  }
  ctx.result = {};
}


export function createServer({ prefix = '/', dbAdapter, /*cloudFunctionRecords, */ validatePassword = (p: string) => p.length > 6, verboseLogging = false, masterKey = null }: ConstructorParameters): Router.IMiddleware {
  const router = new Router({ prefix })
  const logger = new (winston.Logger)()
  
  const locks: Locks = defaultdict(() => new Semaphore(1)) as any as Locks

  router.use(bodyParser())
  router.use(loggingMiddleware(logger, verboseLogging))
  router.use(setHeaderMiddleware())
  router.use(errorHandlingMiddleware())
  router.use(dateAwareJsonHandlingMiddleware())
  router.use(sessionHandlingMiddleware(dbAdapter, locks))



  router.post('/_signUp', signUp(dbAdapter, validatePassword))
  router.post('/_logIn', logIn(dbAdapter))
  router.post('/_logOut', logOut(dbAdapter))

  // router.post('/_synchronizeUser', server.synchronizeUser)

  // cloudFunctionRecords.forEach(({ name }) => {
  //   router.post(`/${name}`, server.convertedCloudFunctions[name]);
  // });

  return router.routes()
}


// export type CloudFunction = (dbAdapter: DbAdapter, user: HotaruUser, params: any, installationDetails: any) => Promise<any>;
// export type CloudFunctionRecord = {
//   name: string;
//   func: CloudFunction;
// };



// export class HotaruServer {
//   private dbAdapter: InternalDbAdapter;
//   // private cloudFunctionRecords: CloudFunctionRecord[];
//   private validatePassword: (password: string) => boolean;
//   private masterKey: string;
//   private logger: winston.LoggerInstance;

//   private locks: { [userId: string]: Semaphore } = defaultdict(() => new Semaphore(1)) as any as { [userId: string]: Semaphore };


//   constructor({ dbAdapter, /*cloudFunctionRecords,*/ validatePassword, enableLogging, masterKey }: ConstructorParameters) {
//     this.dbAdapter = dbAdapter;
//     // this.cloudFunctionRecords = cloudFunctionRecords;
//     this.validatePassword = validatePassword;
//     this.masterKey = masterKey;
//     this.

//       if(enableLogging) {
//       this.logger.add(winston.transports.Console);
//     }

//     dbAdapter.logger = this.logger;

//     _.bindAll(this, [
//       'signUp',
//       'logIn',
//       'logOut',
//       'synchronizeUser',
//     ]);


//     // cloudFunctionRecords.forEach(({ name, func }) => {
//     //   if (!isAlphanumeric(name)) {
//     //     throw new HotaruError(HotaruError.NON_ALPHANUMERIC_CLOUD_FUNCTION_NAME);
//     //   }

//     //   this.convertedCloudFunctions[name] = this.routeHandlerWrapper(this.loggedInRouteHandlerWrapper(this.cloudFunctionWrapper(func)));
//     // })
//   }

//   static createServer({ dbAdapter, /*cloudFunctionRecords, */ validatePassword = (p: string) => p.length > 6, enableLogging = false, masterKey = null }: ConstructorParameters): Router.IMiddleware {
//     const server = new HotaruServer({ dbAdapter, /*cloudFunctionRecords, */ validatePassword, enableLogging, masterKey });

//     const router = new Router();
//     // router.use(json());

//     router.use(bodyParser)
//     router.use(server.initialLoggingMiddleware)
//     router.use(HotaruServer.setHeaderMiddleware)
//     router.use(server.errorHandlingMiddleware)
//     router.use(HotaruServer.dateAwareJsonHandlingMiddleware)
//     router.use(server.sessionHandlingMiddleware)


//     router.post('/_signUp', server.signUp);

//     router.post('/_logIn', server.logIn);
//     router.post('/_logOut', server.logOut);

//     router.post('/_synchronizeUser', server.synchronizeUser);

//     // cloudFunctionRecords.forEach(({ name }) => {
//     //   router.post(`/${name}`, server.convertedCloudFunctions[name]);
//     // });

//     return router.routes();
//   }




//   // cloudFunctionWrapper(cloudFunction: CloudFunction): LoggedInRouterHandler {
//   //   return async (body: any, sessionId: string, user: HotaruUser): Promise<any> => {
//   //     const { params, installationDetails } = body;

//   //     return await cloudFunction(this.dbAdapter, user, params, installationDetails);
//   //   }
//   // }



//   async synchronizeUser(body: any, sessionId: string, user: HotaruUser): Promise<any> {
//     const clientChangelog = body.clientChangelog as UserChange[];

//     const userData = user._getDataStore().getRawData();
//     let localChangelog = user._getDataStore().getChangelog();

//     const sortedClientChangelog = clientChangelog.sort((a, b) => a.date - b.date);
//     sortedClientChangelog.forEach(change => {
//       switch (change.type) {
//         case 'set':
//           {
//             const existingNewerSet = localChangelog.find(c =>
//               c.type === 'set' && c.date > change.date && c.field === change.field
//             );
//             if (existingNewerSet === undefined) {
//               localChangelog = localChangelog.filter(c => c.field !== change.field || c.date > change.date);
//               const laterLocalIncrementsAndAppends = localChangelog.filter(c => c.field === change.field);
//               userData[change.field] = change.value;
//               laterLocalIncrementsAndAppends.forEach(c => {
//                 if (c.type === 'increment') {
//                   userData[change.field] += c.value;
//                 } else if (c.type === 'append') {
//                   userData[change.field].append(c.value);
//                 } else {
//                   throw new HotaruError(HotaruError.INVALID_CHANGE_TYPE);
//                 }
//               });
//               localChangelog.push(change);
//             }
//           }
//           break;
//         case 'increment':
//           {
//             const existingNewerSet = localChangelog.find(c =>
//               c.type === 'set' && c.date > change.date && c.field === change.field
//             );
//             if (existingNewerSet === undefined) {
//               if (userData[change.field] === undefined) {
//                 userData[change.field] = 0;
//               }
//               userData[change.field] += change.value;
//               localChangelog.push(change);
//             }
//           }
//           break;
//         case 'append':
//           {
//             const existingNewerSet = localChangelog.find(c =>
//               c.type === 'set' && c.date > change.date && c.field === change.field
//             );
//             if (existingNewerSet === undefined) {
//               if (userData[change.field] === undefined) {
//                 userData[change.field] = [];
//               }
//               userData[change.field].push(change.value);
//               localChangelog.push(change);
//             }
//           }
//           break;
//       }
//     });

//     // We append new changes at the end in the loop above even if they should be placed
//     // somewhere in the middle
//     localChangelog.sort((a, b) => a.date - b.date);

//     const newUser = new HotaruUser(new SelfContainedUserDataStore(userData, localChangelog));

//     const savedNewUser = await this.dbAdapter.saveUser(newUser);
//     const processedChanges = clientChangelog.map(c => c._id);

//     return { userData: this.dbAdapter.stripInternalFields(savedNewUser._getDataStore().getRawData()), processedChanges };
//   }
// }
