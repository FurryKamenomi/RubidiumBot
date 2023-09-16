/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

import cl, { TBotRank } from '@base/client';
import cm from '@module/common';
import ch from '@module/configHelper';

import icqq from 'icqq';
import { jce, pb } from 'icqq/lib/core';
import _ from 'lodash';

import events from 'node:events';
import fs from 'node:fs';


export type TPluginInfomation = {
  handle: string,
  status?: boolean,
  classObj: unknown
}


const _pluginMap = new Map<string, TPluginInfomation>;

/**
 * Group command Map.
 * @param string pluginHandle.
 * @param TPluginCommandInfo registered command info.
 */
const _groupCommandMap = new Map<string, TCommandInfomation<'group'>>;

/**
 * Private command Map.
 * @param string pluginHandle.
 * @param TPluginCommandInfo registered command info.
 */
const _privateCommandMap = new Map<string, TCommandInfomation<'private'>>;


// --- --- --- --- --- --- ---
/**
 *     Register Plugin In Common(Router).
 */


interface CpluginRouter {
  on(event: 'group.command.request', callback: (prototype: icqq.GroupMessageEvent, command: string, argument?: unknown[]) => void): this
  on(event: 'private.command.request', callback: (prototype: icqq.PrivateMessageEvent, command: string, argument?: unknown[]) => void): this

  on(event: 'group.self.nickname', callback: (val: { event_id: number, group_id: number, user_id: number, new_nickname: string }) => void): this;
  on(event: string, callback: (prototype: never, argument?: never[]) => void): this
}

class CpluginRouter extends events.EventEmitter {
  private _client = cl.instance;
  private _detectGroup = /\/[\u4e00-\u9fa5_a-zA-Z0-9]+@/;
  private _detectPrivate = /\/[\u4e00-\u9fa5_a-zA-Z0-9]+#/;


  public constructor() {
    super({
      captureRejections: true
    });

    this._client.once('system.online', this.RouterInit.bind(this));
  }



  get pm() {
    return <Readonly<typeof _pluginMap>>_pluginMap
  }

  get cl() {
    return <Readonly<typeof this._client>>this._client;
  }



  private RouterInit() {
    this.on('group.self.nickname', (val) => {
      this._client
        .pickGroup(val.group_id)
        .pickMember(val.user_id)
        .renew();
    })

    this._client
      .on('internal.sso', this.SSOExtraEvent.bind(this))
      .on('message.group', this.GroupCommandProcessor.bind(this))
      .on('message.private', this.PrivateCommandProcessor.bind(this));

    this.LoadAllPlugin();
  }




  private async GroupCommandProcessor(messageEvent: icqq.GroupMessageEvent) {
    if (!await this.CheckRequest(messageEvent.raw_message, messageEvent.group))
      return;

    const raw = messageEvent.raw_message;
    const nickname = messageEvent.group.pickMember(this._client.uin).card || this._client.nickname;
    const command = raw.slice(1, raw.indexOf('@'));
    const argument = raw.split('@').slice(1).join('@').slice(nickname.length).split(' ');
    this.emit('group.command.request', messageEvent, command, argument);

    [..._groupCommandMap.values()].forEach(val => {
      const { group_id, sender } = messageEvent;
      const { event_id, command: cmd, isRegexp, allow_ids, rank } = val;

      if (allow_ids && !allow_ids.includes(group_id))
        return;

      if (cl.whoIs(sender.user_id) !== rank)
        return;

      if (isRegexp) {
        if (!(new RegExp(cmd)).test(command))
          return
      }

      if (cmd !== command)
        return;

      this.emit(event_id, messageEvent, argument);
    });
  }

  private async PrivateCommandProcessor(messageEvent: icqq.PrivateMessageEvent) {
    if (!await this.CheckRequest(messageEvent.raw_message))
      return;

    const raw = messageEvent.raw_message;
    const command = raw.slice(1, raw.indexOf('#'));
    const argument = raw.split('#').slice(1).join('#').split(' ');
    this.emit('private.command.request', messageEvent, command, argument);

    [..._privateCommandMap.values()].forEach(val => {
      const { user_id } = messageEvent.sender;
      const { event_id, command: cmd, isRegexp, allow_ids, rank } = val;

      if (allow_ids.length !== 0 && !allow_ids.includes(user_id))
        return

      if (cl.whoIs(user_id) !== rank)
        return;

      if (isRegexp && !(new RegExp(cmd)).test(command)) {
        return
      }

      if (cmd !== command)
        return;

      this.emit(event_id, messageEvent, argument);
    });
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



  private async CheckRequest(text: string, group?: icqq.Group) {
    if (!group) {
      return !!text.match(this._detectPrivate)?.[0];
    }
    const matchState = text.match(this._detectGroup)?.[0];
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
      cl.clientLogger.Error(`Missing ${basePath} Direct! `);
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
        cl.clientLogger.Error(`${file} Load Fail. \n${err}`);
        return;
      }

      _pluginMap.set(file, {
        handle: cm.Md5(_.uniqueId('plugin_')),
        classObj: object
      });

      if (_pluginMap.has(file))
        cl.clientLogger.Info(`Load ${file} Success. `);
    });
  }
}

function SortRegisterCommandMap(isPrivate: boolean = false) {
  if (isPrivate) {
    const arrayMap = Array
      .from(_privateCommandMap)
      .sort((a, b) => a[1].level - b[1].level);
    _privateCommandMap.clear();

    arrayMap.forEach(val => { _privateCommandMap.set(val[0], val[1]) });

    return;
  }
  const arrayMap = Array
    .from(_groupCommandMap)
    .sort((a, b) => a[1].level - b[1].level);
  _groupCommandMap.clear();

  arrayMap.forEach(val => { _groupCommandMap.set(val[0], val[1]) });
}



const pluginRouter = new CpluginRouter;





// --- --- --- --- --- --- ---
/**
 *     Register Command In Template.
 */


export type TCommandOption = {
  rank?: TBotRank,
  level?: number,
  allow_ids?: number[],
}

export type TCommandInfomation<T extends 'group' | 'private'> = {
  command: string, // Support regexp.
  isRegexp: boolean,
  event_id: string,
  rank: TBotRank,
  type: T,
  level: number
  allow_ids: number[] // Group_id or User_id.
}



declare interface CpluginTemplate {
  /**
   * RegisterGroupCommand
   * 
   * @protected
   */
  RegisterGroupCommand(cmd: string, options?: TCommandOption): string;

  /**
   * RegisterPrivateCommand
   * 
   * @protected
   */
  RegisterPrivateCommand(cmd: string, options?: TCommandOption): string;

  /**
   * BindMessageOnce
   * 
   * @protected
   */
  BindMessageOnce<T extends 'message.group' | 'message.private'>(event: T, target_id: number, listener: icqq.EventMap[T]): () => boolean | void;
}

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



  public RegisterGroupCommand(cmd: string, options?: TCommandOption): string {
    let isRegexp = false;
    try {
      isRegexp = !!(new RegExp(cmd))
    } catch { /* It is not. */ }

    options = this.DefaultCommandOption(options);

    const registerStruc: TCommandInfomation<'group'> = {
      command: cmd,
      isRegexp,
      event_id: `${this.__HANDLE__}.group.${isRegexp ? _.uniqueId() : cmd}`,
      type: 'group',
      ...<Required<TCommandOption>>options
    }

    _groupCommandMap.set(this.__HANDLE__, registerStruc);

    SortRegisterCommandMap();
    return registerStruc.event_id;
  }



  public RegisterPrivateCommand(cmd: string, options?: TCommandOption): string {
    let isRegexp = false;
    try {
      isRegexp = !!(new RegExp(cmd))
    } catch { /* It is not. */ }

    options = this.DefaultCommandOption(options);

    const registerStruc: TCommandInfomation<'private'> = {
      command: cmd,
      isRegexp,
      event_id: `${this.__HANDLE__}.private.${isRegexp ? _.uniqueId() : cmd}`,
      type: 'private',
      ...<Required<TCommandOption>>options
    }

    _privateCommandMap.set(this.__HANDLE__, registerStruc);

    SortRegisterCommandMap(true);
    return registerStruc.event_id;
  }

  public BindMessageOnce<T extends 'message.group' | 'message.private'>(event: T, target_id: number, listener: icqq.EventMap[T]) {
    let disponse: () => boolean | void;
    const client = this._router.cl;

    const bindListener: icqq.EventMap[T] = (messageEvent: never) => {
      const sender_id = _.get(messageEvent, 'sender.user_id') || _.get(messageEvent, 'from_id');
      if (sender_id !== target_id)
        disponse = client.once(event, bindListener);

      return (<icqq.EventMap[T]>listener)(messageEvent);
    };

    disponse = client.once(event, bindListener);
    return disponse;
  }



  private DefaultCommandOption(option?: TCommandOption): TCommandOption {
    return {
      rank: 'user',
      level: 32767,
      allow_ids: new Array<number>,
      ...option
    }
  }
}

export default {
  pluginTemplate: CpluginTemplate,
  pluginRouter,
}