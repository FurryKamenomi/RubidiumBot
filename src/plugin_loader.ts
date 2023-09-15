/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

import client from '@base/client';
import icqq from 'icqq';
import events from 'node:events';
import fs from 'node:fs';

import { jce, pb } from 'icqq/lib/core';
import _ from 'lodash';
import ch from '@module/configHelper';



interface CpluginRouter {
  on(event: 'group.command.request', callback: (prototype: icqq.GroupMessageEvent, command: string, argument?: unknown[]) => void): this
  on(event: 'group.self.nickname', callback: (val: { event_id: number, group_id: number, user_id: number, new_nickname: string }) => void): this;
  on(event: string, callback: (prototype: icqq.GroupMessageEvent, argument?: unknown[]) => void): this
}

type TPluginInfo = {
  handle: string,
  status?: boolean,
  classObj: unknown
}

type TPluginCommandInfo = {
  command: string, // Support regexp.
  isRegexp: boolean,
  event_id: string,
  type: 'group',
  level: number
}



const _pluginMap = new Map<string, TPluginInfo>;

/**
 * Map.
 * @param string pluginHandle.
 * @param TPluginCommandInfo registered command info.
 */
const _registerCommandMap = new Map<string, TPluginCommandInfo>;



class CpluginRouter extends events.EventEmitter {
  private _client = client.instance;
  private _detectFormat = /\/[\u4e00-\u9fa5_a-zA-Z0-9]+@/;

  public constructor() {
    super({
      captureRejections: true
    });

    this._client.once('system.online', this.RouterInit.bind(this));
  }



  get pm() { return <Readonly<typeof _pluginMap>>_pluginMap }



  private RouterInit() {
    this.on('group.self.nickname', (val) => {
      this._client
        .pickGroup(val.group_id)
        .pickMember(val.user_id)
        .renew();
    })

    this._client
      .on('internal.sso', this.SSOExtraEvent.bind(this))
      .on('message.group', async messageEvent => {
        if (!await this.CheckRequest(messageEvent.raw_message, messageEvent.group))
          return;

        const raw = messageEvent.raw_message;
        const nickname = messageEvent.group.pickMember(this._client.uin).card || this._client.nickname;
        const command = raw.slice(1, raw.indexOf('@'));
        const argument = raw.split('@').slice(1).join('@').slice(nickname.length).split(' ');
        this.emit('group.command.request', messageEvent, command, argument);

        [..._registerCommandMap.values()].forEach(val => {
          if (val.isRegexp) {
            if (!(new RegExp(val.command)).test(command))
              return
          }

          if (val.command !== command)
            return;

          this.emit(val.event_id, messageEvent, argument);
        })
      });

    this.LoadAllPlugin();
  }



  private SSOExtraEvent(cmd: string, payload: Buffer) {
    switch (cmd) {
      case 'OnlinePush.ReqPush': { /* Own nickname be changed. */
        let dataRaw = jce.decode(payload);
        dataRaw = jce.decode(dataRaw[7]);

        if (!dataRaw[0].req['OnlinePushPack.SvcReqPushMsg'])
          return;

        dataRaw = jce.decode(dataRaw[0].req['OnlinePushPack.SvcReqPushMsg']);
        if (dataRaw[0][2][0][2] !== 528)
          return;

        try {
          dataRaw = jce.decode(dataRaw[0][2][0][6]);
        } catch { return }

        if (dataRaw[0] !== 39)
          return;

        let detailInfo = <pb.Proto>pb.decode(dataRaw[10])[1];

        try {
          if (detailInfo[2] !== 0x51) // Event ID 81
            return;
        } catch { return }

        const targetInfo = {
          event_id: <number>detailInfo[2],
          group_id: 0,
          user_id: 0,
          new_nickname: ''
        };

        detailInfo = detailInfo[13];

        targetInfo['group_id'] = detailInfo[1];
        targetInfo['user_id'] = detailInfo[2];
        targetInfo['new_nickname'] = (
          <Buffer>detailInfo[3][0]
          || <Buffer>detailInfo[3][2]
          || ''
        ).toString('utf-8');

        return this.emit('group.self.nickname', targetInfo);
      }
    }
  }



  private async CheckRequest(text: string, group: icqq.Group) {
    const matchState = text.match(this._detectFormat)?.[0];
    const targetNickname = text.split('@')[1]?.split(' ')[0];

    if (!matchState || text.indexOf(matchState || '') !== 0)
      return false;

    const groupNickname = group.pickMember(this._client.uin).card || this._client.nickname;

    return groupNickname === targetNickname;
  }



  private async LoadAllPlugin() {
    const basePath = process.cwd() + '/src/plugins/';
    let files = new Array<string>;

    try {
      files = fs.readdirSync(basePath, { encoding: 'utf-8' })
    } catch {
      client.clientLogger.Error(`Missing ${basePath} Direct! `);
      return;
    }


    files.forEach(async file => {
      if (!file.endsWith('.ts'))
        return;

      let object: { default?: new () => unknown };

      try {
        object = await require(basePath + file);

        if (!object['default'])
          throw 'Missing Default Class Export. ';

        new object.default;
      } catch (err) {
        client.clientLogger.Error(`${file} Load Fail. \n${err}`);
        return;
      }

      _pluginMap.set(file, {
        handle: _.uniqueId('plugin_'),
        classObj: object
      });

      if (_pluginMap.has(file))
        client.clientLogger.Info(`Load ${file} Success. `);
    });
  }
}

function SortRegisterCommandMap() {
  const arrayMap = Array
    .from(_registerCommandMap)
    .sort((a, b) => a[1].level - b[1].level);
  _registerCommandMap.clear();

  arrayMap.forEach(val => { _registerCommandMap.set(val[0], val[1]) });
}



const pluginRouter = new CpluginRouter;


// --- --- --- --- --- --- ---

// interface IpluginCommandInfo {
//   cmd: string,
//   procFuncName: string,
//   level: number,

//   description?: string
// }

/**
 * @class
 * @abstract
 * @description PluginTemplate \
 * i.  include `pluginRouter object`; \
 * ii. perhaps using `RegisterCommand/CommandExtra` Method.
 */
class CpluginTemplate {
  public _router = pluginRouter;
  public _config?: typeof ch.configHelper;

  public constructor(
    private __HANDLE__: string,
    private __USE_CONFIG__: boolean = false
  ) {
    if (this.__USE_CONFIG__) {
      let file = __HANDLE__.split('/').at(-1);
      file = file || 'unknown';
      file = _.dropRight(file.split('.')).join('.');
      file = process.cwd() + '/src/plugins/configs/' + file;
      fs.mkdirSync(process.cwd() + '/src/plugins/configs/' + file);

      this._config = ch.configHelper.bind(file + '/');
    }
  }

  // protected RegisterCommand(data: IpluginCommandInfo): string
  protected RegisterCommand(command: string, level?: number): string
  protected RegisterCommand(cmd: string /*| IpluginCommandInfo*/, level: number = 0): string | undefined {
    if (typeof cmd === 'string') {
      let isRegexp = false;
      try {
        isRegexp = !!(new RegExp(cmd))
      } catch { /* It is not. */ }

      const registerStruc: TPluginCommandInfo = {
        command: cmd,
        isRegexp,
        event_id: `${this.__HANDLE__}.group.${isRegexp ? _.uniqueId() : cmd}`,
        type: 'group',
        level
      }

      _registerCommandMap.set(this.__HANDLE__, registerStruc);

      SortRegisterCommandMap();
      return registerStruc.event_id;
    }

    if (typeof cmd !== 'object')
      return;

    // and Todo so.

    return;
  }
}

export default {
  pluginTemplate: CpluginTemplate,
  pluginRouter,
}