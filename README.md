# 🌐 Aid Flow Visualization Project (援助流动可视化项目)

这是一个基于 **D3.js** 构建的交互式数据可视化项目，旨在分析全球援助数据（AidData）。项目通过多种视图展示了不同国家之间的援助流动关系、资金的具体用途（Purpose）以及随时间变化的趋势。

## 📊 可视化视图 (Visualizations)

本项目包含三个核心可视化模块，分别从不同维度剖析数据：

### 1. 援助流动概览 (Visualization 1: Aid Flows Overview)
* **文件**: `vis1.html`, `vis1.js`
* **核心功能**: 展示全球主要援助国（Donors）与受援国（Recipients）之间的宏观资金流动。
* **主要交互**:
    * **Sankey-like 节点链接图**: 左侧列出前 20 大援助国，右侧列出前 10 大受援国，连线宽度代表援助金额（USD Constant）。
    * **高亮与聚焦**: 悬停或点击任意国家节点，系统会高亮显示与其相关的所有连线，并将无关元素半透明化，以此清晰展示该国的援助网络。
    * **详情展示**: 页面下方包含详细图表（Detail Chart），点击节点后展示该国前 5 大援助目的（Purpose）的金额统计。

### 2. 援助关系与目的分析 (Visualization 2: Aid Relationships by Purpose)
* **文件**: `vis2.html`, `vis2.js`
* **核心功能**: 深入挖掘特定援助关系背后的资金用途分布。
* **主要交互**:
    * **双向饼图联动**: 
        * **关系饼图 (Pair Pie)**: 点击特定的连线（例如 "Japan -> Thailand"），展示这两个国家之间援助资金的用途构成。
        * **国家饼图 (Country Pie)**: 点击国家节点，展示该国作为援助国或受援国的总体资金用途分布。
    * **图例系统**: 提供了详细的颜色图例，支持通过颜色快速识别教育、医疗、基础设施等不同援助类型。

### 3. 交互式时间序列探索 (Visualization 3: Interactive Aid Explorer)
* **文件**: `vis3.html`, `vis3.js` (及 `vis3-1.html` 备用版本)
* **核心功能**: 探索援助数据随时间（Year）的动态变化趋势。
* **主要交互**:
    * **多图表联动**: 界面包含主趋势图（Main Chart）、带状图（Strip Chart）和饼图（Pie Chart）。
    * **时间轴交互**: 
        * 用户可以在时间轴上悬停或刷选（Brush），查看特定年份或时间段内的援助金额变化。
        * 下方带状图可能用于展示特定类别的密度或分布。
    * **侧边栏控制**: 左侧提供控制面板（Sidebar），用于筛选特定的援助国、受援国或援助目的，实现数据的钻取分析。

### 4. 综合视图 (Combined View)
* **文件**: `vis_all.html`
* **功能**: 这是一个集成页面，将上述三个独立的可视化视图整合在一起，方便用户在一个页面内浏览完整的故事线。

## 🛠️ 技术栈 (Tech Stack)

* **D3.js (v7)**: 用于处理数据绑定、比例尺计算、DOM 操作及 SVG 绘图的核心库。
* **HTML5 & CSS3**: 构建响应式布局（Flexbox），提供清晰的视觉样式和交互反馈（如 tooltip 悬浮框）。
* **JavaScript (ES6+)**: 使用模块化方式编写逻辑，包含数据清洗（Data Cleaning）、转换（Rollups）及事件监听。

## 📂 文件结构 (File Structure)

| 文件名 | 描述 |
| :--- | :--- |
| `vis_all.html` | **入口文件**，集成所有视图的综合页面。 |
| `vis1.html` / `.js` | 视图 1：宏观流动概览。 |
| `vis2.html` / `.js` | 视图 2：援助目的深度分析。 |
| `vis3.html` / `.js` | 视图 3：时间序列交互探索（主版本）。 |
| `vis3-1.html` / `.js`| 视图 3 的备用/变体版本。 |
| `aiddata-countries-only.csv` | 项目使用的核心数据集，包含年份、国家、金额和目的代码。 |
| `README.md` | 项目说明文档。 |

## 🚀 如何运行 (How to Run)

由于 D3.js 需要加载本地 CSV 数据，受浏览器的跨域策略（CORS）限制，直接双击 HTML 文件可能无法正常显示。请使用本地服务器运行：

1.  **Python (推荐)**:
    ```bash
    # Python 3
    python -m http.server 8000
    # 然后访问 http://localhost:8000/vis_all.html
    ```

2.  **Node.js (http-server)**:
    ```bash
    npx http-server
    # 然后访问生成的本地地址
    ```

3.  **VS Code**:
    安装并使用 **Live Server** 插件，右键 `vis_all.html` 选择 "Open with Live Server"。

---
*数据来源: AidData (aiddata-countries-only.csv)*
