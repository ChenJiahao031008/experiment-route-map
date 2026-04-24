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
npm run preview
```

## 目录结构

```text
src/
  components/
    editor/       实验详情表单
    flow/         实验树画布与节点卡片
    layout/       页面布局、工具栏和详情面板
  lib/            图数据处理与导出工具
  store/          Zustand 状态管理
  styles/         全局样式和主题变量
  types/          实验文档类型定义
config/           Vite、Vitest、ESLint 和 TypeScript 配置
tests/            单元测试
public/           静态图标资源
```

## 数据说明

实验数据会通过 Zustand persist 保存在浏览器本地存储中。点击“导出 JSON”可保存当前实验树，点击“导入 JSON”会解析文件并在确认后替换当前实验树。
