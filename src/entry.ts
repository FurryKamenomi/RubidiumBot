import logger from '@module/logger';

import { jsonc } from 'jsonc';
import _ from 'lodash';

import fs from 'node:fs';


export interface IEnvArguments {
  env: 'dev' | 'prod'
}

export interface IAccountConfig {
  account: number,
  password: string,
  alwaysLogin: boolean,
  platform: import('icqq').Platform,
  signApi: string
}

export interface IBotConfig {
  owner: number,
  admin: Array<number>
}

export interface IConfig {
  account: IAccountConfig,
  bot: IBotConfig
}


let processArgv: IEnvArguments = <never>{};
const processLogger = logger.Init(undefined, 'Rubidium');
const config: IConfig = {
  account: <never>{},
  bot: <never>{}
};


processLogger.Info('Process running. ');

config.account = LoadConfig('/configs/account.jsonc');
config.bot = LoadConfig('/configs/bot.jsonc');

let procArgv = process.argv;

if (procArgv.indexOf('--') !== -1) {
  procArgv = procArgv.slice(procArgv.indexOf('--') + 1);

  procArgv.forEach(val => {
    const item = val.split(':');
    if (item.length === 1)
      (<never>processArgv)[val] = <never>undefined;
    else
      (<never>processArgv)[item[0]] = <never>item[1];
  });
}

CompleteArgv();



function LoadConfig<T>(path: string) {
  try {
    return <T>
      jsonc.parse(
        fs.readFileSync(
          process.cwd() + path
        ).toString('utf-8')
      );
  } catch (e) {
    processLogger.Fatal(`Load .${path} fail. `);
    process.exit(1);
  }
}

function CompleteArgv() {
  processArgv = ObjectKeyDefault(processArgv, 'env', 'dev', 'String');
}

function ObjectKeyDefault(
  origin: object,
  key: string,
  defaultVal: unknown,
  defaultType: 'String' | 'Number' | 'Boolean' = 'String'
): never {
  let val = _.get(origin, key);

  if (_.has(origin, key))
    return <never>origin;

  if (typeof val !== defaultType.toLowerCase()) {
    try {
      val = _.get(global, defaultType, String)!(val);
    } finally {
      _.set(origin, key, val);
    }
  }

  if (typeof defaultVal === defaultType.toLowerCase())
    _.set(origin, key, defaultVal);

  return <never>origin;
}

processLogger.Debug('Currrent arguments', processArgv);

export default {
  config,
  processArgv,
  processLogger
}

import '@base/client';
