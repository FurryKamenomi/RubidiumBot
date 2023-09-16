import pl from '@base/plugin_loader';
import icqq from 'icqq';

export default class FuckNative extends pl.pluginTemplate {
  constructor(
    reserved: string
  ) {
    super(reserved);

    let eventID = this.RegisterGroupCommand('ping');

    this._router.on(eventID, (proto: icqq.GroupMessageEvent) => {
      proto.reply('Pong. ');
    });

    eventID = this.RegisterGroupCommand('time');
    
    this._router.on(eventID, (proto: icqq.GroupMessageEvent) => {
      proto.reply((new Date).toLocaleString('zh-CN'));
    });

    eventID = this.RegisterPrivateCommand('time');
    
    this._router.on(eventID, (proto: icqq.PrivateMessageEvent) => {
      proto.reply((new Date).toLocaleString('zh-CN'));
    });
  }
}