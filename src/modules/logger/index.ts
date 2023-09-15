import fs from 'node:fs';

interface ILoggerInstance {
  get CurrentModule(): {
    name: string,
    path: string
  }

  Raw(...rest: unknown[]): void;

  Log(...rest: unknown[]): void;
  Info(...rest: unknown[]): void;
  Warn(...rest: unknown[]): void;
  Error(...rest: unknown[]): void;
  Fatal(...rest: unknown[]): void;
  Debug(...rest: unknown[]): void;
}

let globalSavingFile = process.cwd() + '/logs/latest.log';
let globalInit = false;

function Init(
  loggerPath?: string,
  projectName: string = 'project',
  hideModulePath: boolean = true
): ILoggerInstance {
  if (!globalInit) globalInit = true;

  if (loggerPath) globalSavingFile = loggerPath;

  return new loggerInput(projectName, process.cwd(), hideModulePath);
}

function RegisterModule(
  moduleName: string = 'NativeModule',
  modulePath: string = '[Unknown]',
  hideModulePath: boolean = true
): ILoggerInstance {
  return new loggerInput(moduleName, modulePath, hideModulePath);
}

class loggerInput implements ILoggerInstance {
  public constructor(
    private moduleName: string,
    private modulePath: string,
    private hiddenPath: boolean
  ) { }

  get CurrentModule() {
    return {
      name: this.moduleName,
      path: this.modulePath
    }
  }

  Raw(...rest: unknown[]): void {
    if (process.stdout.writable)
      process.stdout.write(rest.map(TranslateType).join(' '))
  }

  Log(...rest: unknown[]): void {
    GeneralLog('log', this.moduleName, this.modulePath, this.hiddenPath, ...rest)
  }

  Info(...rest: unknown[]): void {
    GeneralLog('Info', this.moduleName, this.modulePath, this.hiddenPath, ...rest)
  }

  Warn(...rest: unknown[]): void {
    GeneralLog('Warn', this.moduleName, this.modulePath, this.hiddenPath, ...rest)
  }

  Error(...rest: unknown[]): void {
    GeneralLog('Error', this.moduleName, this.modulePath, this.hiddenPath, ...rest)
  }

  Fatal(...rest: unknown[]): void {
    GeneralLog('Fatal', this.moduleName, this.modulePath, this.hiddenPath, ...rest)
  }

  Debug(...rest: unknown[]): void {
    GeneralLog('Debug', this.moduleName, this.modulePath, this.hiddenPath, ...rest)
  }
}

function GeneralLog(level: string, name: string, path: string, hiddenPath: boolean, ...content: unknown[]) {
  level = level.toUpperCase().padEnd(5, ' ');
  content = content.map(TranslateType);

  const layout = [
    (new Date).toISOString(),
    level,
    `[${name}${!hiddenPath && path
      ? `@(${path})`
      : ''
    }]`,
    content.join(' ')
  ].join(' - ');

  process.stdout.write(layout + '\r\n', () => void 0);
  fs.appendFile(globalSavingFile, layout + '\n', () => void 0);
}

function TranslateType(data: unknown) {
  if (Array.isArray(data))
    return `[${data.toString()}]`;

  switch (typeof data) {
    case 'object':
      return JSON.stringify(data);
    case 'function':
      return `${data.name}()`;
    default:
      return data?.toString() || `[${typeof data}]`;
  }
}

export default {
  Init,
  RegisterModule
}