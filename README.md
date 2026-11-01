# 跑步 · DSH 插件（VDOT 跑力 + E/M/T/I/R 配速）

[![ci](https://github.com/Okinging/dsh-running/actions/workflows/ci.yml/badge.svg)](https://github.com/Okinging/dsh-running/actions/workflows/ci.yml)

在 DeepSeek Harness Web GUI 的左侧栏新增「跑步」入口，点开后在中央区域显示「跑步」页面。一期只做一个功能「跑力」：按 Jack Daniels 的 VDOT 方法，用一场比赛成绩反算跑力值，并给出 E/M/T/I/R 五区训练配速与等效成绩。

纯前端实现：不注册 Host 资源，所有计算在浏览器里完成，成绩只存在本机 `localStorage`。

## 安装

需要 DSH `0.2.1-rc.2` 或同一次版本线（`^0.2.1-rc.2`）。

1. 把本仓库装进 profile（推荐的 git 方式，固定到 tag）：

   ```bash
   pnpm add "git+https://github.com/Okinging/dsh-running.git#v1.0.0"
   ```

   也可以直接让 DSH 里的 Agent 用插件管理器安装同样的 git spec。

2. 在 profile 的 `package.json` 里把 `@local/dsh-running` 加进 `dsh.profile.bundles`，重启 DSH。
3. 左侧栏出现跑步小人图标，点开即用。

> **关于包名**：包名沿用 `@local/dsh-running`（最初以 `link:` 方式本地安装，改名会打断现有安装）。从 git 安装时 pnpm 会照常按这个包名写入依赖，不影响使用。

### 在市场「发现」页安装（可选）

DSH 目前没有官方插件市场，但支持添加第三方索引源。本仓库的 `docs/index.json` 就是格式 1 的索引，由 GitHub Pages 提供：

1. 先在「插件」页启用实验性的**自定义插件市场**（若还没启用）。
2. 打开「插件 → 发现 → 添加索引源」，填：

   ```
   https://okinging.github.io/dsh-running/index.json
   ```

3. 搜索「跑步」，安装 `1.0.0`。索引条目固定到具体 commit，升级才会有变化。

## 使用

1. 左侧栏图标栏点「跑步」（图标是跑步小人）。
2. 在页面里选择比赛距离、输入完赛成绩（`20:00` 或 `1:31:31`），结果即时更新。
3. 页面会把最近一次输入保存在浏览器本地（`localStorage` 键 `dsh.running.v1`），再次进入自动恢复。

## 数据口径

- 反算公式（Daniels & Gilbert, *Oxygen Power*, 1979，不调参）：
  - `VO2(v) = -4.60 + 0.182258·v + 0.000104·v²`（v：米/分钟）
  - `%VO2max(t) = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)`（t：分钟）
  - `VDOT = VO2(v) / %VO2max(t)`
- 五区强度（%VO2max）：E 59–74、M 75–84、T 83–88、I 95–100、R 105–110。
- 页面显示的是由公式实时计算的结果，不是印刷表抄录；与印刷表逐格对拍见 `tools/vdot-check.mjs`（开发期脚本，不随包加载）。
- 本仓库不含书籍印刷表的整表数据，只保留对拍用的算法与少量公开锚点。

## 开发

```bash
node tools/vdot-check.mjs        # 算法锚点、40 格公开表对拍、格式化/解析边界
node tools/component-smoke.cjs   # 用 React 钩子桩加载 client.js，冒烟渲染注册与页面
npm test                         # 上面两个一起跑
```

CI（GitHub Actions）在每次 push / PR 时跑这两个自检，并执行 `npm pack --dry-run` 确认打包内容。

## 版本

- 1.0.0：一期「跑力」（VDOT + E/M/T/I/R）。

## 兼容性与反馈

- 已验证运行环境：DSH `0.2.1-rc.2`（Windows，Web GUI）。
- DSH 仍在 `0.2.x` 快速迭代，客户端模块 API 可能变动；遇到不兼容请在 Issues 里附上 DSH 版本与报错。

## 许可

[MIT](LICENSE)。VDOT 公式来自 Daniels & Gilbert 的公开论文，本仓库的实现与页面对拍数据由本仓库自行生成。
