# 🌐 Aid Flow Visualization Project (援助流动可视化项目)

这是一个使用 **D3.js** 构建的交互式数据可视化项目，旨在分析和展示全球援助（Aiddata）在不同国家之间、不同目的以及不同年份间的流动模式。

所有可视化内容通过一个统一的入口文件 `vis_all.html` 集成和切换。

## 文件结构

本项目包含以下关键文件：

| 文件名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `vis_all.html` | HTML | **主入口文件。** 使用 `iframe` 统一加载并提供切换 `vis1`、`vis2` 和 `vis3` 的界面。 |
| `vis1.html` | HTML/JS | **可视化 1：概览。** 展示全球 Top N 捐助国（Donor）和受助国（Recipient）之间的援助网络（可能是力导向图或弦图），并提供细节图展示某国与其他国家的双边援助额。 |
| `vis2.html` | HTML/JS | **可视化 2：按目的分类。** 展示援助流向主要目的（Purpose）的分布情况，并提供饼图等方式分析特定国家援助的用途构成。 |
| `vis3.html` | HTML/JS | **可视化 3：时序模式。** 允许用户按年份筛选数据，或以时间序列图的形式展示某个国家（或某个双边关系）援助额随时间的变化。 |
| `aiddata-countries-only.csv` | CSV | **原始数据文件。** 包含援助流动记录，包括年份、捐助国、受助国、承诺金额和援助目的等信息。 |

## 🚀 如何运行项目

**重要提示：** 由于浏览器安全限制 (CORS)，您不能直接双击 HTML 文件打开。您需要通过一个本地 Web 服务器运行此项目。

### 推荐方法：使用 Python 启动本地服务器

1.  打开命令行 (Terminal/CMD)，导航到包含所有 HTML 和 CSV 文件的项目文件夹。
2.  运行以下命令启动一个简易 Web 服务器：

    ```bash
    # 推荐使用 Python 3
    python -m http.server 8000 
    ```

3.  在浏览器中打开以下地址：

    ```
    http://localhost:8000/vis_all.html
    ```

### 替代方法：使用 VS Code Live Server

如果您使用 VS Code，安装 **Live Server** 插件，在 `vis_all.html` 文件上右键选择 `Open with Live Server`。

## ⚙️ 技术栈

* **数据可视化库：** D3.js (版本 5 或更高)
* **前端语言：** HTML5, CSS3, JavaScript
* **数据格式：** CSV

## 👨‍💻 Git 提交历史

本项目使用 Git 进行版本控制，以跟踪代码和数据文件的所有修改。

---
