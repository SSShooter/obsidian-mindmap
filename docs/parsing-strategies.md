# Obsidian Mindmap 解析策略分析

本文档分析了 `obsidian-mindmap` 插件中处理 Markdown 并生成导图的三种主要方式：**Code Block (代码块)**、**Markdown 文件转导图** 以及 **MindElixir Plaintext 格式处理**。

## 1. 核心解析方式对比

| 特性 | 代码块 (`mindelixir`) | Markdown 文件转导图 | MindElixir Plaintext 文件 |
| :--- | :--- | :--- | :--- |
| **触发位置** | `main.ts` (Markdown 处理器) | `MindMapView.ts` (视图加载) | `MindMapView.ts` (视图加载) |
| **识别条件** | 代码块语言为 `mindelixir` | 文件内容不以 `- ` 开头 | 文件内容以 `- ` 开头 |
| **解析函数** | `parsePlaintext` | `parseMarkdown` | `parsePlaintext` |
| **底层技术** | `mind-elixir` 内置转换器 | `unified` + `remark` AST | `mind-elixir` 内置转换器 |
| **可编辑性** | **不可编辑** (静态渲染) | **不可编辑** (只读预览) | **可编辑** (双向同步) |
| **持久化** | 无 (由 Markdown 文档存储) | 无 (仅供预览) | **有** (自动写回文件) |

---

## 2. 详细分析

### 2.1 Code Block (代码块渲染)
在 `main.ts` 中通过 `registerMarkdownCodeBlockProcessor` 注册。它允许用户在任何笔记中嵌入导图。
- **解析逻辑**：调用 `parsePlaintext`。它将代码块内的文本视为 MindElixir 的标准缩进格式。
- **渲染特点**：为了保证笔记性能，它是非交互式的（关闭了工具栏和编辑功能），主要用于展示。
- **数学公式**：通过 `renderMath` 支持 LaTeX 公式渲染。

### 2.2 Markdown 文件转导图 (标准 MD 转换)
这是将一个普通的 Markdown 文件（以标题和列表组织）可视化为导图的功能。
- **解析逻辑**：在 `parser.ts` 的 `parseMarkdown` 函数中，使用 `remark` 将 Markdown 转换为抽象语法树 (AST)。
- **层级处理**：
    - 基于标题深度 (`h1` - `h6`) 构建父子关系。
    - 列表项 (`list`) 会被合并到其前一个兄弟节点作为子节点。
- **局限性**：由于标准 Markdown 到导图的映射不是完全 1:1 对等的（例如导图的节点坐标、连线、样式在标准 MD 中无对应语法），因此该模式下是**只读**的，不支持将导图修改写回标准 MD。

### 2.3 MindElixir Plaintext (原生导图格式)
当用户打开一个以 `- ` 开头的 Markdown 文件时，插件会认为这是一个专门的导图数据文件。
- **格式规范**：使用 MindElixir 定义的缩进文本格式（类似列表但包含 ID、样式等元数据）。
- **核心优势**：**支持编辑**。
    - 在 `MindMapView.ts` 中，`editable` 被设置为 `true`。
    - 插件通过监听 MindElixir 的 `operation` 事件，在用户修改导图后自动调用 `mindElixirToPlaintext` 并将结果写回文件。
- **双向绑定**：它是目前唯一支持从导图 UI 修改并保存到本地文件的模式。

---

## 3. 总结

- **`parseMarkdown`**：负责将复杂的、非结构化的 MD 文档进行“降级”展示，通过 AST 提取层级。
- **`parsePlaintext`**：是插件的“原生”语言。既用于简单的代码块展示，也用于支撑完整的导图编辑体验。
- **文件识别启发式 (Heuristic)**：`MindMapView` 通过 `data.trim().startsWith("- ")` 这一简单规则来切换“预览模式”和“编辑模式”。
