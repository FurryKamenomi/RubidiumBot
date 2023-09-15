import fs from 'node:fs'
import _ from 'lodash';
import logger from '@module/logger';
import { jsonc } from 'jsonc';


interface IAccount {
  account: number,
  password: string,
  alwaysLogin: boolean,
  platform: import('icqq').Platform,
  signApi: string
}

interface INativeArgv {
  env: 'dev' | 'prod'
}

let nativeArgv: INativeArgv = <never>{};
const nativeLogger = logger.Init(undefined, 'Rubidium');
const config: {
  account: IAccount
} = {
  account: <never>{}
};

(function __process_entry__() {
  nativeLogger.Info('Process running. ');

  try {
    config.account = <IAccount>
      jsonc.parse(
        fs.readFileSync(
          process.cwd() + '/configs/account.jsonc'
        ).toString('utf-8')
      );
  } catch (e) {
    nativeLogger.Fatal('Load ./configs/account.jsonc fail. ');
    process.exit(1);
  }

  // it isn't a array.
  // config.account.platform--;

  let procArgv = process.argv;

  if (procArgv.indexOf('--') !== -1) {
    procArgv = procArgv.slice(procArgv.indexOf('--') + 1);

    procArgv.forEach(val => {
      const item = val.split(':');
      if (item.length === 1)
        (<never>nativeArgv)[val] = <never>undefined;
      else
        (<never>nativeArgv)[item[0]] = <never>item[1];
    });
  }

  CompleteArgv();
})();

function CompleteArgv() {
  nativeArgv = ObjectKeyDefault(nativeArgv, 'env', 'dev', 'String');
}

function ObjectKeyDefault(
  origin: object,
  key: string,
  defaultVal: unknown,
  defaultType: 'String' | 'Number' | 'Boolean' = 'String'
): never {
  let val = _.get(origin, key);

  if (_.has(origin, key)) return <never>origin;

  if (typeof val !== defaultType.toLowerCase()) {
    try {
      val = _.get(global, defaultType, String)!(val);
    } catch (error) {
      // 错误处理，如果转换失败则保留原值
    } finally {
      _.set(origin, key, val);
    }
  }

  if (typeof defaultVal === defaultType.toLowerCase())
    _.set(origin, key, defaultVal);

  return <never>origin;
}

nativeLogger.Debug('Currrent arguments', nativeArgv);

export default {
  config,
  nativeArgv,
  nativeLogger
}

import '@base/client';