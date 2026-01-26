# 🌐 Aid Flow Visualization Project

This is an interactive data visualization project built with **D3.js**, designed to analyze global aid data (AidData). The project utilizes multiple views to demonstrate the aid flow relationships between different countries, specific purposes of funding, and evolving trends over time.

## 📊 Visualizations

The project consists of three core visualization modules, analyzing data from different dimensions:

### 1. Aid Flows Overview

* **Files**: `vis1.html`, `vis1.js`
* **Core Functionality**: Displays macro-level financial flows between major global donors and recipients.
* **Key Interactions**:
* **Sankey-like Node-Link Diagram**: The left column lists the top 20 donors, and the right column lists the top 10 recipients. The width of the connecting lines represents the aid amount (USD Constant).
* **Highlight & Focus**: Hovering over or clicking any country node highlights all related connections and fades out irrelevant elements to clearly showcase that country's aid network.
* **Detail Display**: Includes a "Detail Chart" at the bottom that displays the top 5 aid purposes by amount for the selected country.



### 2. Aid Relationships by Purpose

* **Files**: `vis2.html`, `vis2.js`
* **Core Functionality**: Dives deep into the distribution of funding purposes behind specific aid relationships.
* **Key Interactions**:
* **Linked Dual Pie Charts**:
* **Pair Pie**: Clicking a specific connection (e.g., "Japan -> Thailand") shows the breakdown of aid purposes between those two countries.
* **Country Pie**: Clicking a country node shows its overall distribution of aid purposes as either a donor or a recipient.


* **Legend System**: Provides a detailed color legend, allowing users to quickly identify different aid categories such as education, health, and infrastructure through color coding.



### 3. Interactive Aid Explorer

* **Files**: `vis3.html`, `vis3.js` (and `vis3-1.html` as an alternative version)
* **Core Functionality**: Explores the dynamic trends of aid data over time (Year).
* **Key Interactions**:
* **Multi-Chart Linkage**: The interface includes a Main Chart, a Strip Chart, and a Pie Chart.
* **Timeline Interaction**:
* Users can hover over or use a brush tool on the timeline to view changes in aid amounts for specific years or periods.
* The strip chart below may be used to show the density or distribution of specific categories.


* **Sidebar Controls**: A control panel on the left allows for filtering by specific donors, recipients, or purposes to enable drill-down analysis.



### 4. Combined View

* **File**: `vis_all.html`
* **Functionality**: An integrated page that combines the three independent visualization views, allowing users to browse the complete data story in a single page.

## 🛠️ Tech Stack

* **D3.js (v7)**: The core library used for data binding, scale calculation, DOM manipulation, and SVG drawing.
* **HTML5 & CSS3**: Used for responsive layouts (Flexbox) and providing clean visual styles and interactive feedback (e.g., tooltips).
* **JavaScript (ES6+)**: Logic written in a modular fashion, including data cleaning, rollups, and event listeners.

## 📂 File Structure

| Filename | Description |
| --- | --- |
| `vis_all.html` | **Entry File**, the comprehensive page integrating all views. |
| `vis1.html` / `.js` | View 1: Macro Flow Overview. |
| `vis2.html` / `.js` | View 2: Deep Analysis of Aid Purposes. |
| `vis3.html` / `.js` | View 3: Interactive Time-Series Explorer (Main version). |
| `vis3-1.html` / `.js` | Alternative/Variant version of View 3. |
| `aiddata-countries-only.csv` | Core dataset containing years, countries, amounts, and purpose codes. |
| `README.md` | Project documentation. |

## 🚀 How to Run

Since D3.js needs to load local CSV data, browser Cross-Origin Resource Sharing (CORS) policies may prevent the project from displaying correctly if you simply double-click the HTML file. Please run it using a local server:

1. **Python (Recommended)**:
```bash
# Python 3
python -m http.server 8000
# Then visit http://localhost:8000/vis_all.html

```


2. **Node.js (http-server)**:
```bash
npx http-server
# Then visit the generated local address

```


3. **VS Code**:
Install and use the **Live Server** extension, right-click `vis_all.html` and select "Open with Live Server".

---

*Data Source: AidData (aiddata-countries-only.csv)*
