# LVGM SVG Demo

一个用于展示 LVGM（Large Vector Graphics Model）矢量图形生成效果的前端演示项目。

## 功能特性

- 选择并预览书法笔画风格的 SVG（my_svgs 分类）
- 选择并预览 DiffVG 几何图形 SVG（diffvg 分类）
- 解析并展示 SVG 的基础信息（viewBox、path 数量、元素数量等）
- Mock 生成功能（模拟后端推理服务）

## 快速开始

### 安装依赖

```bash
cd frontend-demo
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看演示。

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
frontend-demo/
├── public/
│   └── examples/
│       ├── manifest.json      # 示例清单文件
│       ├── my_svgs/           # 书法笔画 SVG
│       └── diffvg/            # DiffVG 几何图形
├── src/
│   ├── components/
│   │   ├── ControlPanel.tsx   # 控制面板组件
│   │   ├── SvgPreview.tsx     # SVG 预览组件
│   │   └── InfoCard.tsx       # 信息卡片组件
│   ├── types.ts               # TypeScript 类型定义
│   ├── App.tsx                # 主应用组件
│   ├── App.css                # 主应用样式
│   ├── main.tsx               # 入口文件
│   └── index.css              # 全局样式
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 添加/更新示例 SVG

1. 将新的 SVG 文件放入对应目录：
   - 书法笔画类：`public/examples/my_svgs/`
   - DiffVG 图形：`public/examples/diffvg/`

2. 更新 `public/examples/manifest.json`：

```json
{
  "examples": [
    {
      "id": "unique-id",
      "label": "显示名称",
      "category": "my_svgs",
      "svgPath": "/examples/my_svgs/filename.svg"
    }
  ]
}
```

字段说明：
- `id`: 唯一标识符
- `label`: 在下拉菜单中显示的名称
- `category`: 分类（`my_svgs` 或 `diffvg`）
- `svgPath`: 相对于 public 目录的路径

## API 协议草案（后续接入后端时使用）

### 请求

```
POST /api/generate
Content-Type: application/json

{
  "text": "一",
  "baseExampleId": "heng",
  "style": "kaishu"
}
```

### 响应

```json
{
  "svgContent": "<svg>...</svg>",
  "processingTime": 1234,
  "generationId": "uuid"
}
```

## 当前状态

**Mock 模式**：点击「生成」按钮会随机从同分类中选择一个 SVG 作为"生成结果"，模拟 500-1200ms 的延迟。

后续可通过修改 `App.tsx` 中的 `handleGenerate` 函数接入真实的 Python 推理后端。

## 技术栈

- Vite
- React 18
- TypeScript
