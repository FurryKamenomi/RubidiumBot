import entry from '@base/entry';
import logger from '@module/logger';
import icqq from 'icqq';
import pngjs from 'pngjs';
import readline from 'node:readline';



export type TBotRank = 'owner' | 'admin' | 'user';



const configAccount = entry.config.account;
const clientLogger = logger.RegisterModule('client');
const cliController = readline.createInterface(process.stdin, process.stdout);
const client = icqq.createClient({
  data_dir: process.cwd() + '/data/account/',
  platform: configAccount.platform,

  auto_server: true,
  ignore_self: true,
  cache_group_member: false,

  // log_level: '',

  sign_api_addr: configAccount.signApi
});

let firstLogin = false;

cliController.once('close', () => {
  if (client.isOnline() && entry.config.account.alwaysLogin) {
    client.logout(false).then(() => {
      process.exit();
    });
  }
  else {
    process.exit();
  }
});


client

  /* As Login */

  .on('system.login.qrcode', ({ image }) => {
    clientLogger.Log('[QRCode Verify] Scan & Pass. ');
    LogQrcode(image);
    cliController.once('line', client.qrcodeLogin.bind(client));
  })

  .on('system.login.slider', ({ url }) => {
    clientLogger.Log('[Slider Verify] Surf & Pass:', url);
    cliController.once('line', client.submitSlider.bind(client));
  })

  .on('system.login.device', ({ url, phone }) => {
    clientLogger.Log('[Device Verify]', phone, 'Select One, A: Web-QRCode | B: Sms-Code');

    cliController.once('line', index => {
      if (index.trim().toLowerCase() === 'a') {
        clientLogger.Log('[Device Verify] Surf & Pass:', url);
        cliController.once('line', client.login.bind(client));
        return;
      }

      client.sendSmsCode();
      clientLogger.Log('[Device Verify] Sms-Code Sent. ');
      cliController.once('line', client.submitSmsCode.bind(client));
    });
  })

  .on('system.login.error', ({ code, message }) => {
    clientLogger.Fatal(`[Login Fail] Code${code}, Reason: ${message}. `);
    process.exit(1);
  })

  /* After Login */

  /* Login / Online Success */
  .on('system.online', () => {
    if (!firstLogin)
      firstLogin = true;

    clientLogger.Log('Online. ');
  })

  /* Offline */

  .on('system.offline.kickoff', ({ message }) => {
    clientLogger.Error(message);
  })

  .on('system.offline.network', ({ message }) => {
    clientLogger.Error(message);
  });

client.login(configAccount.account, configAccount.password);

function LogQrcode(img: Buffer) {
  const png = pngjs.PNG.sync.read(img);
  const colors = {
    blk: '\x1b[30m',
    wht: '\x1b[37m',
    bg_blk: '\x1b[40m',
    bg_wht: '\x1b[47m'
  };

  for (let i = 36; i < png.height * 4 - 36; i += 24) {
    let line = '';
    for (let j = 36; j < png.width * 4 - 36; j += 12) {
      const pos = i * png.width + j;

      const bgcolor = png.data[pos] == 255
        ? colors.bg_wht
        : colors.bg_blk;
      const fgcolor = png.data[pos + (png.width * 12)] == 255
        ? colors.wht
        : colors.blk;

      line += `${fgcolor + bgcolor}\u2584`;
    }
    console.log(line + '\x1b[0m');
  }
}


// Bot-Method --- --- --- --- --- --- --- --- ---

function WhoIs(user_id: number): TBotRank {
  const config = entry.config.bot;
  if (user_id === config.owner)
    return 'owner';

  return config.admin.includes(user_id) ? 'admin' : 'user';
}


export default {
  entry,
  instance: client,
  clientLogger,
  cliController,
  whoIs: WhoIs.bind(this),

  firstLogin,
}

import '@base/plugin_loader';
