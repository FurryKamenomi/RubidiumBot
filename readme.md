# Rubidium Bot

**Open Scoure With [MPL2.0 License](http://mozilla.org/MPL/2.0/)**
**本项目处于开发阶段(DEV)，出现任意问题请及时提交Issues！**

> Rubidium (Rbi) 这是一个基于 [ICQQ](https://github.com/icqqjs/icqq) 库开发的QQ机器人。
> 项目名称取自于化学元素周期表，没有任何含义。

[toc]

## 安装

以下含有控制台键入等，一律在项目根目录运行。

1. 安装项目依赖项
  控制台键入 `npm install` 以安装。

2. 初始化配置文件
  打开其配置文件 `/configs/*.jsonc` 并且修改必要内容。
  ***配置文件内含有选项注释***

3. 调试
  你可以在控制台键入 `npm run dev` 进行调试或运行。
  ***具体命令可见 `/package.json` 中 script 项***

## 使用

命令格式为 (参数之间以空格隔开)
在群聊当中：`/<command>@<Bot> <...arguments>` e.g. `/time@Rbi` ；
在私聊当中：`/<command># <...arguments>` e.g. `/ping#` ；

项目内置Bot基础功能 `/ping@bot`, `/time@bot` 等。
***(P.S. 若出现了 `SSOEvent` 错误内容或调用不成功，仅是群聊自身昵称获取错误，可以尝试复原群昵称或者过一会时间自行刷新。)***

> 更多扩展由你实现！

## 插件编写

### 创建插件

***Rbi项目通过 ts-node 的 `experimentalTsImportSpecifiers` 选项动态导入 \*.ts 文件 (可能会出现意想不到的问题！将在后续版本增加动态导入 \*.js 文件)***

1. 在 `/src/plugins/` 中创建你的第一个插件！（以 .ts 结尾）

2. 导入基类, Exmaple:

  ```Typescript
    import pl from '@base/plugin_loader';

    export default class Foo extends pl.pluginTemplate {
      constructor(reserved: string) {
        super(reserved, false /* Using config */);
      }
    }
  ```

---

`pl.pluginTemplate` 类提供了以下公开接口/成员：

1. `_router` 插件调度对象 (~~路由器对象~~)
  进行允许的全局 Api 调用

2. `_config` 插件配置文件对象 (Optional)
  根据 `super()` 中第二个参数 `useConfig` 来选择是否创建该对象，
  默认false则该对象为 `undefined` ;

3. `RegisterGroupCommand()` & `RegisterPrivateCommand()` 注册插件公开命令
  具有相同的参数：
    · `cmd: string` 注册的命令名称 (支持正则匹配)
    · `rank: 'owner' | 'admin' | 'user'` 命令权限 (与群聊权限无关)
    · `option: TCommandOption` 其他选项 (Optionl, { level = 32767, allow_id = Array })
    · ·  优先前后以及允许的群聊id或者用户id

### 创建命令

Rbi项目使用的是事件调度的方式进行命令调度，以来更简单地上手编写。
Example:

```Typescript
  // ...
    
    let EventID = this.RegisterGroupCommand('cmd');
    Router.on(EventID, (Origin, command, argument) => {
      // To process.
    });

  // ...
```

你也可以监听 `group.command.request`, `private.command.request` 来监听全局命令消息。
