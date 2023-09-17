import pl from '@base/plugin_loader';
import cm from '@module/common';
import axios from 'axios';
import icqq from 'icqq';
import fs from 'node:fs';

// import _ from 'lodash';

type TEventIDMap = Map<string, string>;

export default class Olympics extends pl.pluginTemplate {
  private dataPath = process.cwd() + '/src/plugins/data/olympics/';

  public constructor() {
    super('Olympics');

    const eventIDs: TEventIDMap = new Map;

    eventIDs.set('AR', this.RegisterPrivateCommand('addRecord', {
      rank: 'owner'
    }));

    eventIDs.set('DR', this.RegisterPrivateCommand('deleteRecord', {
      rank: 'owner'
    }));

    eventIDs.set('GR', this.RegisterGroupCommand('getRecord'));

    
    this._router.on(eventIDs.get('AR')!, (proto: icqq.PrivateMessageEvent) => {
      proto.reply('Start Recording! ');

      this.BindMessageOnce('message.private', proto.sender.user_id, this.AddRecord.bind(this));
    })
    .on(eventIDs.get('DR')!, this.deleteRecord.bind(this))
    .on(eventIDs.get('GR')!, this.getRecord.bind(this))
  }

  private AddRecord(message: icqq.PrivateMessageEvent) {
    const sender_id = message.from_id;
    const firstMessage = message.message.at(0)!;

    if (firstMessage.type !== 'text' && firstMessage.type !== 'image') {
      message.reply('Wrong data! Try again. ');
      this.BindMessageOnce('message.private', sender_id, this.AddRecord.bind(this));
      return;
    }

    // I dont know why are me need do that.
    if (firstMessage.type === 'text') {
      if (firstMessage.text !== '.exit') {
        message.reply('Wrong command! Exit!. ');
        return;
      }
      
      message.reply('Exit! ');
      return;
    }

    message.reply('Received!');

    // const uniqueID = cm.Md5(_.uniqueId('olympics.img'));
    const date = new Date;
    const uniqueID = cm.Md5(
      String(date.getFullYear())
      + String(date.getMonth() + 1).padStart(2, '0')
      + String(date.getDate()).padStart(2, '0')
    );

    axios.get<fs.WriteStream>(firstMessage.url!, {
      responseType: 'stream',
    }).then(val => {
      return val.data.pipe(fs.createWriteStream(this.dataPath + uniqueID + '.jpg'));
    }).then(val => val.on('close', () => {
      message.reply(`Completed! Current ID: ${uniqueID}. You can delete by it or send. `);
    }));
  }

  private deleteRecord(proto: icqq.PrivateMessageEvent, argument?: string[]) {
    if (argument == undefined || !argument.at(0))
      return proto.reply('Missing argument! ');

    if (!/[A-Fa-f0-9]+/.test(argument[0]))
      return proto.reply('Hell! ');

    fs.rm(this.dataPath + argument[0] + '.jpg', err => {
      if (err) {
        return proto.reply(err.name + ' | ' + err.message);
      }
      return proto.reply('Delete success, the ID was unuseful!');
    });
  }

  private getRecord(proto: icqq.GroupMessageEvent, argument?: string[]) {
    console.log(argument)
    if (!argument || !argument[0])
      return proto.reply('Missing argument! ');

    const file = this.dataPath + cm.Md5(argument[0]) + '.jpg';
    if (!fs.existsSync(file)) {
      return proto.reply('No data! ');
    }

    proto.reply([
      cm.Md5(argument[0]),
      icqq.segment.image(file)
    ]);
  }
}