import cm from '@module/common';

import _ from 'lodash';

import fs from 'node:fs';

class CconfigHelper {
  static Bind(config_path: string) {
    return new this(config_path);
  }

  private _fileData = new Map<string, unknown>
  private _fileMd5Map = new Map<string, string>;

  public constructor(
    private _configPath: string
  ) {
    fs.watch(this._configPath, _.debounce<fs.WatchListener<string>>(this.Refresh.bind(this), 125));
  }

  public Config<T>(file: string): T | undefined;
  public Config<T>(file: string, data: T): void
  public Config<T>(file: string, data?: T): T | undefined | void {
    if (data) {
      return fs.writeFile(this._configPath + '/' + file, JSON.stringify(data), _.noop);
    }

    return <T>this._fileData.get(file);
  }

  private Refresh: fs.WatchListener<string> = (event, fileName) => {
    if (event === 'rename')
      return;

    if (!fileName)
      return;

    const rawConfig = fs.readFileSync(fileName, { encoding: 'utf-8' });

    const latestMd5 = cm.Md5(rawConfig);
    if (this._fileMd5Map.get(fileName) === latestMd5)
      return;

    this._fileMd5Map.set(fileName, latestMd5);

    try {
      this._fileData.set(fileName, JSON.parse(rawConfig));
    } catch {
      this._fileData.set(fileName, rawConfig);
    }
  }
}

export default {
  configHelper: CconfigHelper
}