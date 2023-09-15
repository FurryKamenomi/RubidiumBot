import pl from '@base/plugin_loader';

export default class FuckNative extends pl.pluginTemplate {
  constructor(
    reserved: string
  ) {
    super(reserved);

    let eventID = this.RegisterCommand('ping', 0);

    this._router.on(eventID, (proto) => {
      proto.reply('Pong. ');
    });

    eventID = this.RegisterCommand('time', 0);
    
    this._router.on(eventID, (proto) => {
      proto.reply((new Date).toLocaleString('zh-CN'));
    });
  }
}