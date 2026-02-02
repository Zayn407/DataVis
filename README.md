# 🌐 Aid Flow Visualization Project

A comprehensive D3.js-based interactive data visualization platform analyzing global aid flows from the AidData dataset. Explore funding relationships, aid purposes, and temporal trends across 40 years of international development assistance.

---

## 📊 Dashboard Overview

The project features a **single unified dashboard** (`index.html`) combining four complementary views into one cohesive interface:

### Main Components (All in index.html)

**1. Aid Flow Network**
- **Purpose**: Sankey-style network showing flows from top 20 donors to top 10 recipients
- **Features**:
  - Left/right ranked lists of donors and recipients
  - Link width and color gradient encode total commitment amounts
  - Interactive click filtering to highlight connections
  - Detail bar chart for top partnerships
  - Hover tooltips with transaction details

**2. Aid Purpose Breakdown**
- **Purpose**: Purpose-centric analysis across five major aid categories
- **Features**:
  - Gradient-colored links showing purpose composition
  - Dual pie charts: pair-level and country-level analysis
  - Interactive selection to explore purpose distributions
  - Purpose legend identifying education, health, infrastructure, etc.
  - Dropdown menus for quick country pair selection

**3. Timeline Explorer**
- **Purpose**: Time-series analysis of aid flows (1973–2013)
- **Features**:
  - Stacked or 100% area chart showing flows over time
  - Brush selection to zoom into specific time ranges
  - Heatmap strip chart (years × countries) for activity visualization
  - Pie chart showing composition at selected year
  - Toggle between Donor/Recipient perspective
  - Year-locking to persist selections while exploring
  - Ranked side panel with top 20 donors or 10 recipients

**4. Unified Dashboard Layout**
- **Top Left**: Purpose breakdown donut chart
- **Top Right**: Main aid flow network
- **Bottom**: Timeline with area chart and strip chart
- **Benefit**: Explore all dimensions simultaneously and see correlations between network structure, purpose allocation, and temporal trends

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **D3.js v7** | Data binding, scales, axes, SVG rendering, interactive transitions |
| **HTML5 & CSS3** | Semantic markup, responsive flexbox layouts, modern styling |
| **JavaScript (ES6+)** | Data aggregation (rollups), state management, event handling |
| **CSV Data** | 8.4 MB dataset with donor, recipient, year, amount, and purpose columns |

---

## 📂 Project Structure

```
DataVis-final/
├── index.html                       # 🎯 Main dashboard (unified entry point)
├── aid-flow-visualization.js        # Network visualization module
├── aid-purpose-breakdown.js         # Purpose breakdown module
├── aid-timeline-explorer.js         # Timeline explorer module
├── aiddata-countries-only.csv       # Dataset (8.4 MB)
└── README.md                        # Project documentation
```

**Single Entry Point**: Only `index.html` - opens the unified dashboard with all four visualizations (network flow, purpose breakdown, timeline explorer, and combined dashboard) fully integrated into one cohesive interface.

---

## 🚀 Getting Started

### Prerequisites
- **Web Browser** (Chrome, Firefox, Safari, Edge — any modern browser)
- **Python 3** or **Node.js** (for local HTTP server)
- **Internet Connection** (first load to fetch D3.js from CDN)

### Installation & Running

#### Option 1: Python (Recommended)
```bash
cd /path/to/DataVis-final
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

#### Option 2: Node.js
```bash
cd /path/to/DataVis-final
npx http-server
# Follow the printed local address (e.g., http://localhost:8080)
```

#### Option 3: VS Code Live Server
1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` or `vis1.html`
3. Select "Open with Live Server"

### Accessing the Dashboard
- **Unified Dashboard**: `http://localhost:8000/index.html`
- **Direct URL** (automatic): `http://localhost:8000/` (automatically loads index.html)

---

## 💡 Dashboard Interaction Guide

All features are available in the single `index.html` dashboard:

### Network View (Top Right)
1. **Explore**: Hover over links and nodes to see tooltip details
2. **Focus**: Click any country node to highlight its partnerships
3. **Reset**: Click blank area or the same node again to reset
4. **Details**: Use the bar chart below to see top partners

### Purpose Breakdown (Top Left)
1. **Select Pair**: Click on a network link (top right)
2. **View Pie**: Pie chart shows purpose composition for that donor-recipient pair
3. **Country Mode**: Click a country node or use dropdown to select
4. **Toggle View**: Switch between Donor and Recipient perspective

### Timeline (Bottom)
1. **Browse**: Hover over the strip chart to see values at each year
2. **Zoom**: Drag on the strip chart to brush-select a time range; main chart zooms
3. **Lock Year**: Click axis label to lock a year; pie updates but you can still browse
4. **Select Entity**: Click side list to focus on specific donor or recipient
5. **Toggle Scale**: Switch between absolute (stacked) and 100% (normalized) views
6. **Normalize**: Checkbox to show percentage shares instead of absolute amounts

---

## 📊 Dataset Details

**Source**: [AidData](https://www.aiddata.org/)  
**File**: `aiddata-countries-only.csv` (8.4 MB)

### Data Schema
| Column | Description |
|--------|-------------|
| `donor` | Country or organization providing aid |
| `recipient` | Country receiving aid |
| `commitment_amount_usd_constant` | Funding amount in USD (constant value) |
| `year` | Year of commitment (1973–2013) |
| `coalesced_purpose_name` | Primary aid category/purpose |

### Data Characteristics
- **Time Range**: 1973–2013 (41 years)
- **Top Donors**: 20 countries by total amount
- **Top Recipients**: 10 countries by total amount
- **Top Purposes**: 5 categories (e.g., Education, Health, Infrastructure)
- **Records**: Millions of individual aid records aggregated by donor-recipient-year-purpose

---

## 🔧 Development & Customization

### Modifying Visualizations
Each visualization is self-contained in its own JavaScript file:
- Edit `aid-flow-visualization.js` to customize Visualization 1
- Edit `aid-purpose-breakdown.js` to customize Visualization 2
- Edit `aid-timeline-explorer.js` to customize Visualization 3

### Key Configuration Constants
```javascript
// Example from aid-flow-visualization.js
const MAIN_WIDTH = 1100;          // SVG width
const MAIN_HEIGHT = 620;          // SVG height
const BASE_OPACITY = 0.75;        // Default link opacity
const NODE_RADIUS = 7;            // Node circle radius
```

### Adding New Data
1. Replace `aiddata-countries-only.csv` with your own CSV file
2. Ensure columns match the expected schema (donor, recipient, amount, year, purpose)
3. Refresh the browser; D3 automatically reloads and re-aggregates

### Styling
CSS is embedded in each HTML file within `<style>` tags. Customize colors, fonts, and spacing there.

---

## 🎯 Key Interactions & Behaviors

### Hover States
- **Links**: Show tooltip with donor, recipient, amount
- **Nodes**: Highlight connected links
- **Timeline**: Show vertical focus line at mouse position

### Click Actions
- **Network nodes**: Focus on that country's flows; update detail chart
- **Timeline year labels**: Lock/unlock that year view
- **Pie charts**: (Interactive but no click action in current version)

### Keyboard
- No keyboard shortcuts currently implemented (future enhancement opportunity)

---

## 📈 Performance Notes

- **Data Size**: 8.4 MB CSV loads in ~1–2 seconds
- **Rendering**: Top 20 donors × top 10 recipients = 200 max links; smooth 60 FPS
- **Timeline**: 40 years × 30 entities = 1,200 cells; efficient band scales
- **Recommended**: Chrome or Firefox for best performance; Safari slightly slower

---

## 🐛 Troubleshooting

### "CSV file not found"
- Ensure `aiddata-countries-only.csv` is in the same directory as HTML files
- Make sure you're accessing via HTTP (not `file://`)

### Visualizations not loading
- Check browser console (F12 → Console tab) for error messages
- Ensure HTTP server is running: `python3 -m http.server 8000`
- Verify D3.js CDN is accessible (requires internet)

### Charts look strange or misaligned
- Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- Clear browser cache
- Test in a different browser

---

## 📚 Code Quality & Standards

### Code Standards (Feb 2026)
- ✅ **Google JavaScript Style Guide** compliance throughout
- ✅ **2-space indentation** (consistent across all files)
- ✅ **camelCase** for variables and functions
- ✅ **UPPER_CASE** for constants
- ✅ **English comments** for clarity and team collaboration
- ✅ **Descriptive file naming** (e.g., `aid-flow-visualization.js`)
- ✅ **Single unified entry point** (`index.html`)
- ✅ **Professional code organization** ready for production

---

## 🤝 Contributing

To contribute improvements:
1. Create a new branch: `git checkout -b feature/your-feature`
2. Make changes to the relevant files
3. Test in all three visualizations
4. Commit with clear messages: `git commit -m "feat: add new feature"`
5. Push and create a Pull Request

### Code Style
- Follow Google JavaScript Style Guide
- Use 2-space indentation
- Add JSDoc comments for new functions
- Name variables in camelCase, constants in UPPER_CASE

---

## 📜 License

This project is for educational and analytical purposes. The AidData dataset is provided under [AidData's terms](https://www.aiddata.org/). Respect intellectual property and cite sources appropriately.

---

## 👥 Authors & Attribution

**Project**: CSE 5544 Data Visualization  
**Data Source**: [AidData](https://www.aiddata.org/)  
**D3.js**: Mike Bostock et al.

---

## 📞 Support & Questions

If you encounter issues:
1. Check the **Troubleshooting** section above
2. Review browser console for error messages (F12)
3. Consult the **QUICK_START.md** guide
4. Read JSDoc comments in the JavaScript files

---

## 🎓 Learning Resources

- **D3.js Documentation**: https://d3js.org/
- **AidData**: https://www.aiddata.org/
- **Google JavaScript Style Guide**: https://google.github.io/styleguide/javascriptguide.html
- **MDN Web Docs**: https://developer.mozilla.org/

---

## 🚀 Future Enhancements

- [ ] Keyboard navigation (arrow keys, Enter/Escape)
- [ ] Export functionality (PNG, SVG, CSV of filtered data)
- [ ] Mobile-responsive design
- [ ] Accessibility improvements (ARIA labels, screen reader support)
- [ ] Unit tests for data aggregation functions
- [ ] Dark mode toggle
- [ ] Additional visualizations (choropleth map, scatter plot)
- [ ] Search and filter UI

---

**Last Updated**: February 2, 2026  
**Status**: Production Ready ✅  
**Version**: 2.0 (Refactored & Optimized)

---

*Start exploring! Open `index.html` in your browser (via HTTP server) and discover global aid patterns.* 🌍
