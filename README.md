# 实验路线演化图

一个用于记录实验分支、对比结论和演化路线的可视化手账工具。应用基于 React Flow 展示实验树，右侧详情面板用于维护每个实验节点的改动内容、结果、结论、标签和附件。

## 功能

- 实验树可视化：支持从任意节点向上下左右方向创建新分支。
- 节点编辑：记录标题、状态、时间、改动内容、实验结果、结论、备注和标签。
- 拖拽布局：节点位置会持久化保存，刷新后保持当前布局。
- 搜索与筛选：按标题、改动、结论、标签或状态弱化无关节点，保留上下文。
- 对比模式：选择一个节点作为对比目标，在详情面板查看差异。
- 附件记录：可为实验节点添加图片附件。
- JSON 导入导出：导出完整实验文档，也可导入 JSON 覆盖当前实验树。

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Flow
- Zustand
- Vitest

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:4173/
```

## 常用命令

```bash
npm run lint
npm run test
npm run build
npm run dist:deb
npm run preview
```

## 打包 deb

项目通过 Electron + electron-builder 打包为 Linux 桌面应用。生成 deb 前先安装依赖：

```bash
npm install
```

生成安装包：

```bash
npm run dist:deb
```

构建完成后，安装包会输出到 `release/` 目录，文件名类似：

```text
release/experiment-route-map_0.0.1_amd64.deb
```

本机安装测试：

```bash
sudo apt install ./release/*.deb
```

安装后可以从系统应用菜单启动“实验路线演化图”。应用数据会保存在 Electron 的本地应用数据目录中，和浏览器开发环境的 localStorage 相互独立。

发布到 GitHub Release 的建议流程：

```bash
npm run lint
npm run test
npm run dist:deb
# 如果 v0.0.1 已经存在，先把 package.json 版本升级到下一个版本。
git tag -a v0.0.2 -m "Release v0.0.2"
git push origin master v0.0.2
```

仓库内置 GitHub Actions：推送 `v*` 标签后会自动构建 deb，并把 `release/*.deb` 上传到对应 GitHub Release。也可以在 Actions 页面手动运行“Build deb package”工作流，只生成构建产物不创建 Release。

## 目录结构

```text
electron/         Electron 桌面应用入口
src/
  components/
    editor/       实验详情表单
    flow/         实验树画布与节点卡片
    layout/       页面布局、工具栏和详情面板
  lib/            图数据处理与导出工具
  store/          Zustand 状态管理
  styles/         全局样式和主题变量
  types/          实验文档类型定义
config/           Vite、Vitest、ESLint、TypeScript 和打包配置
tests/            单元测试
public/           静态图标资源
release/          本地打包产物，默认不提交
```

## 数据说明

实验数据会通过 Zustand persist 保存在浏览器本地存储中。点击“导出 JSON”可保存当前实验树，点击“导入 JSON”会解析文件并在确认后替换当前实验树。
