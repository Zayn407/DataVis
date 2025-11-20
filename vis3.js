// vis3.js - Final Version with Pie Chart & Opacity Logic

const margin = { top: 10, right: 30, bottom: 30, left: 50 };
const width = 850 - margin.left - margin.right;
const heightMain = 350 - margin.top - margin.bottom;
const heightStrip = 180 - margin.top - margin.bottom;

// 1. 准备 SVG
const svgMain = d3.select("#main-chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", heightMain + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const svgStrip = d3.select("#strip-chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", heightStrip + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

// 🌟 准备饼图 SVG
const pieWidth = 200, pieHeight = 200, pieRadius = Math.min(pieWidth, pieHeight) / 2;
const svgPie = d3.select("#pie-chart").append("svg")
    .attr("width", pieWidth)
    .attr("height", pieHeight)
    .append("g")
    .attr("transform", `translate(${pieWidth/2},${pieHeight/2})`);

// 中心文字 (显示年份总额)
const pieLabel = svgPie.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#333");

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// 垂直辅助线
const focusLineMain = svgMain.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", heightMain).attr("stroke", "#ff4d4f").attr("stroke-width", 1).attr("stroke-dasharray", "4 4").style("opacity", 0).style("pointer-events", "none");
const focusLineStrip = svgStrip.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", heightStrip).attr("stroke", "#ff4d4f").attr("stroke-width", 1).attr("stroke-dasharray", "4 4").style("opacity", 0).style("pointer-events", "none");

// 全局变量
let rawData = [];
let topDonors = [], topRecipients = [];
let yearRange = [];
let x, y, colorScale;
let currentSelection = "ALL";
let isNormalized = false;
let currentChartData = []; // 存储当前展示的数据，供饼图使用

// 加载数据
d3.csv("aiddata-countries-only.csv").then(data => {
    rawData = data.map(d => ({
        donor: d.donor,
        recipient: d.recipient,
        amount: +d.commitment_amount_usd_constant,
        year: +d.year
    })).filter(d => d.amount > 0 && d.year);

    const calcTotals = (key) => d3.rollups(rawData, v => d3.sum(v, d => d.amount), d => d[key])
        .map(d => ({ name: d[0], total: d[1] })).sort((a, b) => b.total - a.total);

    topDonors = calcTotals("donor").slice(0, 20);
    topRecipients = calcTotals("recipient").slice(0, 10);

    const donorSet = new Set(topDonors.map(d => d.name));
    const recipSet = new Set(topRecipients.map(d => d.name));
    rawData = rawData.filter(d => donorSet.has(d.donor) && recipSet.has(d.recipient));

    const extent = d3.extent(rawData, d => d.year);
    yearRange = d3.range(extent[0], extent[1] + 1);

    x = d3.scaleLinear().domain(extent).range([0, width]);
    y = d3.scaleLinear().range([heightMain, 0]);
    colorScale = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3));

    const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));
    svgMain.append("g").attr("transform", `translate(0,${heightMain})`).call(xAxis);
    svgStrip.append("g").attr("transform", `translate(0,${heightStrip})`).call(xAxis);
    svgMain.append("g").attr("class", "y-axis");

    const radios = document.querySelectorAll("input[name='viewMode']");
    radios.forEach(r => {
        r.addEventListener("change", function() {
            document.querySelectorAll(".radio-group label").forEach(l => l.classList.remove("active"));
            this.parentElement.classList.add("active");
            currentSelection = "ALL";
            updateSideList(this.value);
        });
    });

    d3.select("#normalizeToggle").on("change", function() {
        isNormalized = this.checked;
        const mode = document.querySelector("input[name='viewMode']:checked").value;
        updateCharts(currentSelection, mode);
    });

    updateSideList("donor");
});

function updateSideList(mode) {
    const container = d3.select("#rankingList");
    container.html(""); 
    const listData = (mode === "donor") ? topDonors : topRecipients;
    const label = (mode === "donor") ? "Top 20 Donors" : "Top 10 Recipients";
    d3.select("#listLabel").text(label);

    const maxTotal = listData[0].total;
    const grandTotal = d3.sum(listData, d => d.total);

    const allItem = container.append("div").attr("class", "rank-item all-item").classed("selected", currentSelection === "ALL")
        .on("click", function() {
            container.selectAll(".rank-item").classed("selected", false);
            d3.select(this).classed("selected", true);
            currentSelection = "ALL";
            updateCharts("ALL", mode);
        });
    allItem.append("div").attr("class", "rank-info").html(`<div class="rank-num" style="color:#eb2f96">★</div><div class="rank-name">ALL (Global Aggregate)</div><div class="rank-value">${d3.format(".2s")(grandTotal)}</div>`);

    const items = container.selectAll(".normal-item").data(listData).enter().append("div")
        .attr("class", "rank-item normal-item")
        .on("click", function(e, d) {
            container.selectAll(".rank-item").classed("selected", false);
            d3.select(this).classed("selected", true);
            currentSelection = d.name;
            updateCharts(d.name, mode);
        });

    items.append("div").attr("class", "rank-bar-bg").style("width", d => (d.total / maxTotal * 100) + "%");
    items.append("div").attr("class", "rank-info").html((d, i) => `<div class="rank-num">${i + 1}</div><div class="rank-name" title="${d.name}">${d.name}</div><div class="rank-value">${d3.format(".2s")(d.total)}</div>`);

    updateCharts(currentSelection, mode);
}

function updateCharts(selectedCountry, mode) {
    const counterpartsData = (mode === "donor") ? topRecipients : topDonors;
    const counterparts = counterpartsData.map(d => d.name);
    colorScale.domain(counterparts);
    updateLegend(counterparts);

    // 准备数据
    currentChartData = yearRange.map(year => {
        const obj = { year: year };
        counterparts.forEach(c => obj[c] = 0);
        return obj;
    });

    // 数据聚合
    rawData.forEach(d => {
        let match = false, targetKey = "";
        if (selectedCountry === "ALL") {
            if (mode === "donor") { if (counterparts.includes(d.recipient)) { match = true; targetKey = d.recipient; } }
            else { if (counterparts.includes(d.donor)) { match = true; targetKey = d.donor; } }
        } else {
            if (mode === "donor") { if (d.donor === selectedCountry && counterparts.includes(d.recipient)) { match = true; targetKey = d.recipient; } }
            else { if (d.recipient === selectedCountry && counterparts.includes(d.donor)) { match = true; targetKey = d.donor; } }
        }
        if (match) {
            const idx = d.year - yearRange[0];
            if (currentChartData[idx]) currentChartData[idx][targetKey] += d.amount;
        }
    });

    // --- Part 1: Stacked Area Chart ---
    const stack = d3.stack().keys(counterparts)
        .offset(isNormalized ? d3.stackOffsetExpand : d3.stackOffsetNone);
    const stackedData = stack(currentChartData);

    if (isNormalized) {
        y.domain([0, 1]);
        svgMain.select(".y-axis").transition().duration(500).call(d3.axisLeft(y).ticks(5, "%"));
    } else {
        const maxVal = d3.max(stackedData, layer => d3.max(layer, d => d[1])) || 100;
        y.domain([0, maxVal]).nice();
        svgMain.select(".y-axis").transition().duration(500).call(d3.axisLeft(y).ticks(5, "s"));
    }

    const area = d3.area().x(d => x(d.data.year)).y0(d => y(d[0])).y1(d => y(d[1]));
    const layers = svgMain.selectAll(".layer").data(stackedData, d => d.key);
    
    layers.enter().append("path").attr("class", "layer")
        .merge(layers).transition().duration(800)
        .attr("fill", d => colorScale(d.key)).attr("opacity", 0.9).attr("d", area);
    layers.exit().remove();

    // 🌟 交互：主图 Mousemove 触发饼图更新
    svgMain.on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const year = Math.round(x.invert(mx));
        if (year < yearRange[0] || year > yearRange[yearRange.length-1]) return;

        updateFocusLines(year); // 移动红线
        drawPie(year, counterparts); // 🌟 画饼图
    }).on("mouseout", () => {
        focusLineMain.style("opacity", 0);
        focusLineStrip.style("opacity", 0);
        // 鼠标移出不清除饼图，保留最后状态，体验更好
    });

    // --- Part 2: Strip Chart (With Opacity) ---
    const stripHeight = heightStrip / counterparts.length;
    const strips = svgStrip.selectAll(".strip-row").data(counterparts, d => d);
    const stripsEnter = strips.enter().append("g").attr("class", "strip-row");
    stripsEnter.append("text").attr("class", "strip-label").attr("x", -10).attr("dy", "0.35em").attr("text-anchor", "end").style("font-size", "10px").style("fill", "#555");
    
    const stripsMerge = stripsEnter.merge(strips).attr("transform", (d, i) => `translate(0, ${i * stripHeight + stripHeight/2})`);
    stripsMerge.select("text").text(d => d);

    // 🌟 颜色深浅逻辑：计算每一行的最大值，用于 Log Scale
    stripsMerge.each(function(countryName) {
        const row = d3.select(this);
        // 1. 找出该国家历史最大金额
        const maxAmt = d3.max(currentChartData, d => d[countryName]);
        // 2. Log 比例尺用于透明度 (避免小金额看不见)
        const opacityScale = d3.scaleLog()
            .domain([1, maxAmt || 1]) // 防止 log(0)
            .range([0.1, 1]); // 最小 0.1，最大 1

        const blocks = row.selectAll("rect").data(yearRange);
        blocks.enter().append("rect").merge(blocks)
            .attr("x", yr => x(yr)).attr("y", -stripHeight/2 + 1)
            .attr("width", width / yearRange.length).attr("height", stripHeight - 2)
            .attr("fill", yr => {
                const pt = currentChartData.find(c => c.year === yr);
                return (pt && pt[countryName] > 0) ? colorScale(countryName) : "#eee";
            })
            // 🌟 设置动态透明度
            .attr("opacity", yr => {
                const pt = currentChartData.find(c => c.year === yr);
                const val = pt ? pt[countryName] : 0;
                return (val > 0) ? opacityScale(Math.max(1, val)) : 1; // 如果是灰色(#eee)则opacity为1
            });
        blocks.exit().remove();
    });
    strips.exit().remove();

    // 辅图也支持移动辅助线和饼图
    svgStrip.on("mousemove", (event) => {
         const [mx] = d3.pointer(event);
         const year = Math.round(x.invert(mx));
         updateFocusLines(year);
         drawPie(year, counterparts);
    });
}

// 辅助函数：更新红线
function updateFocusLines(year) {
    const lineX = x(year);
    focusLineMain.style("opacity", 1).attr("x1", lineX).attr("x2", lineX);
    focusLineStrip.style("opacity", 1).attr("x1", lineX).attr("x2", lineX);
}

// 🌟 新增：绘制饼图函数
function drawPie(year, keys) {
    const dataRow = currentChartData.find(d => d.year === year);
    if (!dataRow) return;

    d3.select("#detail-title").text(`${year} Breakdown`);

    // 转换数据格式给 d3.pie
    const pieData = keys.map(k => ({ key: k, value: dataRow[k] || 0 })).filter(d => d.value > 0);
    const total = d3.sum(pieData, d => d.value);

    // 饼图生成器
    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(pieRadius * 0.5).outerRadius(pieRadius * 0.9); // 甜甜圈

    // Join
    const slices = svgPie.selectAll("path").data(pie(pieData), d => d.data.key);

    slices.enter().append("path")
        .merge(slices)
        .attr("d", arc)
        .attr("fill", d => colorScale(d.data.key))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    slices.exit().remove();

    // 中心文字更新
    pieLabel.text(d3.format(".2s")(total));
    
    // 如果没有数据，显示 No Data
    if (total === 0) {
        pieLabel.text("No Data");
        svgPie.selectAll("path").remove();
    }
}

function updateLegend(names) {
    const container = d3.select("#legend-container");
    container.html("");
    names.forEach(name => {
        const item = container.append("div").attr("class", "legend-item");
        item.append("div").attr("class", "legend-color").style("background-color", colorScale(name));
        item.append("span").text(name);
    });
}