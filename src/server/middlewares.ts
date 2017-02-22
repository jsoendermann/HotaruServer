import * as winston from 'winston'
import * as Koa from 'koa'
import { HotaruError, Query, HotaruUser, SelfContainedUserDataStore } from 'hotaru';
import { parse, stringify } from 'date-aware-json'
import Semaphore from 'semaphore-async-await'

import { InternalDbAdapter } from '../db/InternalDbAdapter'


const PACKAGE_VERSION = require(`${__dirname}/../package.json`).version; // eslint-disable-line

export const loggingMiddleware = (logger: winston.LoggerInstance, verboseLogging: boolean) => async (ctx: Koa.Context, next: Function) => {
  // console.log(JSON.stringify(ctx))
  await next()
  // console.log(JSON.stringify(ctx))
}

export const setHeaderMiddleware = () => async (ctx: Koa.Context, next: Function) => {
  ctx.response.type = 'application/json; charset=utf-8'
  await next()
}

export const errorHandlingMiddleware = () => async (ctx: Koa.Context, next: Function) => {
  try {
    await next()
  } catch (error) {
    console.log(`Error: ${error.stack}`)

    const response = { status: 'error', code: error.hotaruErrorCode || -1, serverVersion: PACKAGE_VERSION }
    ctx.body = response
  }
}

export const dateAwareJsonHandlingMiddleware = () => async (ctx: Koa.Context, next: Function) => {
  const payloadString = ctx.request.body.payloadString

  if (payloadString === undefined) {
    throw new HotaruError(HotaruError.NO_PAYLOAD_SENT)
  }

  const payload = parse(payloadString)
  ctx.payload = payload
  await next()
  const result = ctx.result

  ctx.body = { payloadString: stringify({ status: 'ok', result, serverVersion: PACKAGE_VERSION }) }
}

type Locks = { [userId: string]: Semaphore }

export const sessionHandlingMiddleware = (dbAdapter: InternalDbAdapter, locks: Locks) => async (ctx: Koa.Context, next: Function) => {
  const sessionId = ctx.payload.sessionId

  if (sessionId === undefined) {
    await next()
    return
  }

  const sessionQuery = new Query('_Session');
  sessionQuery.equalTo('_id', sessionId);
  const session = await dbAdapter.internalFirst(sessionQuery);

  if (session === null) {
    throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
  }

  await locks[session.userId].wait();
  try {
    const userQuery = new Query('_User');
    userQuery.equalTo('_id', session.userId);
    const userData = await dbAdapter.internalFirst(userQuery);

    if (userData === null) {
      // This is weird, the user must've gotten deleted after the session was created.
      // The best course of action here is probably to delete the session and pretend
      // it didn't exist in the first place
      await dbAdapter.internalDeleteObject('_Session', session);
      throw new HotaruError(HotaruError.SESSION_NOT_FOUND);
    }

    const user = new HotaruUser(new SelfContainedUserDataStore(userData, userData.__changelog));

    await next()
  } finally {
    locks[session.userId].signal();
  }
}