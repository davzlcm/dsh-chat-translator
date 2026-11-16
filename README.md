# 外贸回复助手 · Trade Reply Assistant

一个 [DSH](https://github.com/deepseek-ai) Web UI 插件：左侧栏一键呼出**浮动翻译窗口**，15 种语言**双向互译**，自动把中文变成简短、能直接发给客户的外贸英文（也支持其他语种）。

A DSH Web UI plugin: a floating, draggable translation window opened from the left sidebar. It turns your Chinese into short, natural trade replies for 1688 and WeChat customers, in 15 languages and both directions.

---

## 功能

- **左侧栏启动键**：点一下图标直接弹出浮动窗口，不切换主画面。
- **浮动小窗**：拖动标题栏移动、拖右下角改大小、`—` 缩成小圆标、`×` 关闭；**缩成的小圆标可以在界面内自由拖动**并记住位置。
- **多语种双向互译**：中文、英语、日语、韩语、西班牙语、法语、德语、葡萄牙语、俄语、阿拉伯语、泰语、越南语、印尼语、土耳其语、意大利语；顶部语言栏一键 `⇄` 互换。
- **模型可选**：语言栏下方一行模型下拉框，列出当前 profile 里所有已配置 provider 及其模型；默认「跟随默认」= DSH 设置里的默认模型，右侧刷新按钮重新拉取列表。
- **正式外贸口吻**：一到两句、25 词以内、只输出目标语言、保留产品名/价格/数量/交期、不编造现货或优惠。
- **自动复制**：译文生成后自动进剪贴板，直接去微信 / 1688 粘贴（可关闭）。
- **历史记录**：勾选删除、一键清空，删除后 6 秒内可撤销。
- **蓝白配色**，位置、大小、语言对、所选模型、历史记录自动保存。

## 安装

### 前置条件

- 已安装 DSH 桌面端（或 Web 端），并至少登录 / 配置了一个模型服务（插件默认用当前 profile 的默认模型，也可以在浮窗里换）。
- 插件本身**没有第三方依赖**，不需要 `npm install`，不需要构建。

### 方式一：本机目录安装（推荐）

1. 把本仓库下载或克隆到本机任意目录，例如 `C:\dsh-plugins\chat-translator`。
2. 打开 DSH，在任意会话里对助手说：

   > 安装本地插件包：C:\dsh-plugins\chat-translator

   助手会调用 `plugin_manager` 的 `install_bundle`，把该目录安装并启用为当前 profile 的 bundle。
3. 左侧栏图标区出现气泡图标即安装成功；如果没出现，刷新一次页面（新装插件的首次加载）。

### 方式二：从 zip 安装

1. 解压 `chat-translator-1.1.0.zip`，得到 `chat-translator` 文件夹。
2. 按方式一第 2 步操作，路径指向解压后的文件夹。

### 安装到其他电脑

1. 把仓库克隆（或把 `chat-translator` 文件夹整体复制）到那台电脑。
2. 在 DSH 里让助手安装该目录。
3. 插件配置保存在该电脑自己的 DSH profile 里，与源电脑无关。

> 插件与 DSH 的关系是「目录链接 + bundle 启用」，所以之后 `git pull` 更新仓库内容，新代码会直接生效（客户端改动热更新，宿主侧改动重启插件后生效，必要时刷新页面）。

## 使用

1. 点左侧栏的气泡图标 → 弹出浮动窗口。
2. 选好原文语言和译文语言（中间 `⇄` 可互换）。
3. （可选）在语言栏下方的模型下拉框里选一个模型；「跟随默认」表示用 DSH 设置里的默认模型。
4. 输入中文，按 **Enter**（`Shift+Enter` 换行）→ 生成译文并自动复制。
5. 去微信 / 1688 粘贴发送。
6. 顶栏：剪贴板图标 = 自动复制开关；勾选框 = 批量删除；垃圾桶 = 清空全部；`—` 缩小；`×` 关闭。

## 翻译风格与模型

翻译走 DSH 宿主侧的 `llm` 服务，system prompt 固定为外贸业务员口吻：

- 只输出目标语言，不加引号、标签或解释；
- 与原句长度、意图一致，问候就回问候，不擅自加问题或承诺；
- 一到两句、25 词以内；
- 产品名、价格、数量、尺寸、颜色、交期原样保留，不编造库存或优惠。

默认跟随 DSH 设置里的默认模型；浮窗语言栏下方的下拉框可以直接切到当前 profile 里其他已配置的 provider / 模型（列表由宿主的 `/chat-translator/models` 汇总各 provider 的 `listModels`，右侧刷新按钮可重新拉取）。

## 目录结构

```
chat-translator/
├── package.json          # bundle 清单（dsh.bundle.patch / dsh.client）
├── cordis.patch.yml      # 向 profile 插入插件行
├── index.js              # Host 半：/chat-translator 接口 + 调用 llm
├── client.js             # Client 半：侧栏入口、浮窗、历史、语言栏
├── icon.svg              # 插件图标
├── locale/{zh,en}.json   # 插件管理器里的标题与描述
├── README.md
└── LICENSE
```

## 接口

插件在宿主侧注册了同源 JSON 接口：

- `GET /chat-translator/health` — 版本、输入上限、当前默认 provider / model、模型目录是否可用。
- `GET /chat-translator/models` — 模型目录（`?refresh=1` 跳过 30 秒缓存）：
  ```json
  {
    "ok": true,
    "default": { "provider": "new-api", "model": "google/gemini-4-hydrogen" },
    "providers": [
      { "id": "deepseek-account", "name": "DeepSeek Account",
        "models": [{ "id": "deepseek-flash", "name": "DeepSeek-V4.1-Flash" }] }
    ]
  }
  ```
- `POST /chat-translator/translate`
  ```json
  {
    "text": "你好",
    "sourceLanguage": "Simplified Chinese",
    "targetLanguage": "English",
    "provider": "deepseek-account",
    "model": "deepseek-flash"
  }
  ```
  `provider` / `model` 可省略，省略即跟随 profile 默认模型；provider 或模型不在目录里时返回 `400 MODEL_UNAVAILABLE`。
  返回
  ```json
  { "ok": true, "translation": "Hello", "provider": "deepseek-account", "model": "deepseek-flash" }
  ```

## 常见问题

**左侧栏没有图标？**
刷新页面；或在 DSH 的插件管理里确认 `@local/chat-translator` 已启用。

**翻译报错 / 一直转圈？**
确认已登录 DeepSeek 账号、网络可用；错误信息会显示在消息卡片上（可点「重试」）。

**模型下拉框里没有某个模型？**
有些 provider（例如只用 API key 的 `deepseek-official`）不会向界面暴露模型列表。先在 DSH 的模型设置里登录 / 配置对应账号，再点浮窗里的刷新按钮重拉一次。

**历史记录存在哪？**
浏览器 localStorage，键名 `dsh.chat-translator.v2`；清除浏览器数据会一并清空。

**会把我输入的内容发到别处吗？**
只发给本机 DSH 配置的模型服务，插件本身不收集、不上传任何数据。

## License

MIT
