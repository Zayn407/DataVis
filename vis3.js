// vis3.js - Fixed Interaction & Clarified Titles

const margin = { top: 20, right: 30, bottom: 30, left: 160 }; 
const width = 850 - margin.left - margin.right;
const heightMain = 350 - margin.top - margin.bottom;
const heightStrip = 180 - margin.top - margin.bottom;

// 1. 初始化 SVG
const svgMain = d3.select("#main-chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", heightMain + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

svgMain.append("defs").append("clipPath").attr("id", "clip").append("rect").attr("width", width).attr("height", heightMain);

const svgStrip = d3.select("#strip-chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", heightStrip + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const pieWidth = 180, pieHeight = 180, pieRadius = Math.min(pieWidth, pieHeight) / 2;
const svgPie = d3.select("#pie-chart").append("svg").attr("width", pieWidth).attr("height", pieHeight).append("g").attr("transform", `translate(${pieWidth/2},${pieHeight/2})`);
const pieLabel = svgPie.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").style("font-size", "12px").style("font-weight", "bold").style("fill", "#333");
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

const focusLineMain = svgMain.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", heightMain).attr("stroke", "#ff4d4f").attr("stroke-width", 1).attr("stroke-dasharray", "4 4").style("opacity", 0).style("pointer-events", "none");
const focusLineStrip = svgStrip.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", heightStrip).attr("stroke", "#ff4d4f").attr("stroke-width", 1).attr("stroke-dasharray", "4 4").style("opacity", 0).style("pointer-events", "none");

let rawData = [];
let topDonors = [], topRecipients = [];
let yearRange = [];
let xMain, xStrip, y, colorScale;
let currentSelection = "ALL";
let isNormalized = false;
let currentChartData = [];
let brush;
let cachedSeriesData = [];
let lockedCountry = null;
let lockedYear = null; 

d3.csv("aiddata-countries-only.csv").then(data => {
    rawData = data.map(d => ({ donor: d.donor, recipient: d.recipient, amount: +d.commitment_amount_usd_constant, year: +d.year })).filter(d => d.amount > 0 && d.year);

    const calcTotals = (key) => d3.rollups(rawData, v => d3.sum(v, d => d.amount), d => d[key]).map(d => ({ name: d[0], total: d[1] })).sort((a, b) => b.total - a.total);
    
    // 确保 Donors 是 Top 20, Recipients 是 Top 10
    topDonors = calcTotals("donor").slice(0, 20);
    topRecipients = calcTotals("recipient").slice(0, 10);

    const donorSet = new Set(topDonors.map(d => d.name));
    const recipSet = new Set(topRecipients.map(d => d.name));
    rawData = rawData.filter(d => donorSet.has(d.donor) && recipSet.has(d.recipient));

    const extent = d3.extent(rawData, d => d.year);
    yearRange = d3.range(extent[0], extent[1] + 1);

    xStrip = d3.scaleLinear().domain(extent).range([0, width]);
    xMain = d3.scaleLinear().domain(extent).range([0, width]);
    y = d3.scaleLinear().range([heightMain, 0]);
    colorScale = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3));

    const xAxisMain = d3.axisBottom(xMain).tickFormat(d3.format("d"));
    const xAxisStrip = d3.axisBottom(xStrip).tickFormat(d3.format("d"));

    svgMain.append("g").attr("class", "x-axis").attr("transform", `translate(0,${heightMain})`).call(xAxisMain);
    svgMain.append("g").attr("class", "y-axis");

    const axisGroup = svgStrip.append("g").attr("class", "x-axis").attr("transform", `translate(0,${heightStrip})`).call(xAxisStrip);
    setupAxisInteraction(axisGroup);

    brush = d3.brushX().extent([[0, 0], [width, heightStrip]]).on("brush end", brushed);
    const brushGroup = svgStrip.append("g").attr("class", "brush").call(brush);

    brushGroup.selectAll(".overlay")
        .on("mousemove", (event) => {
            if (lockedYear) return; 
            const [mx] = d3.pointer(event);
            const year = Math.round(xStrip.invert(mx));
            updateFocusLines(year);
            drawPie(year, colorScale.domain());
            highlightAxisLabel(year); 
        })
        .on("mouseout", () => {
            if (lockedYear) return;
            focusLineMain.style("opacity", 0);
            focusLineStrip.style("opacity", 0);
            highlightAxisLabel(null); 
        })
        .on("click", (event) => {
            const [mx] = d3.pointer(event);
            const year = Math.round(xStrip.invert(mx));
            toggleYearLock(year); 
        });

    const radios = document.querySelectorAll("input[name='viewMode']");
    radios.forEach(r => {
        r.addEventListener("change", function() {
            document.querySelectorAll(".radio-group label").forEach(l => l.classList.remove("active"));
            this.parentElement.classList.add("active");
            currentSelection = "ALL";
            lockedCountry = null;
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

function brushed(event) {
    const selection = event.selection;
    if (selection) xMain.domain([xStrip.invert(selection[0]), xStrip.invert(selection[1])]);
    else xMain.domain(xStrip.domain());
    svgMain.select(".x-axis").call(d3.axisBottom(xMain).tickFormat(d3.format("d")));
    redrawMainChart();
}

function setupAxisInteraction(g) {
    g.selectAll(".tick text")
        .style("cursor", "pointer") 
        .style("font-size", "11px")
        .style("transition", "all 0.2s")
        .on("mouseover", function() {
            if (!d3.select(this).classed("locked-label")) d3.select(this).style("fill", "#1890ff").style("font-weight", "bold");
        })
        .on("mouseout", function() {
            if (!d3.select(this).classed("locked-label")) d3.select(this).style("fill", "currentColor").style("font-weight", "normal");
        })
        .on("click", (event, d) => toggleYearLock(d));
}

function highlightAxisLabel(year) {
    d3.selectAll(".x-axis .tick text").style("fill", "currentColor").style("font-weight", "normal").classed("locked-label", false);
    if (year !== null) {
        d3.selectAll(".x-axis .tick").filter(d => d === year).select("text")
            .style("fill", "#ff4d4f").style("font-weight", "bold").style("font-size", "13px").classed("locked-label", true); 
    }
}

function toggleYearLock(year) {
    if (lockedYear === year) {
        lockedYear = null; 
        highlightAxisLabel(null);
        focusLineMain.style("opacity", 0);
        focusLineStrip.style("opacity", 0);
    } else {
        lockedYear = year; 
        highlightAxisLabel(year);
        updateFocusLines(year);
        drawPie(year, colorScale.domain());
    }
}

function updateSideList(mode) {
    const container = d3.select("#rankingList");
    container.html(""); 
    const listData = (mode === "donor") ? topDonors : topRecipients;
    
    // 🌟 更新侧边栏标题，更清晰
    const labelText = (mode === "donor") ? "Select Donor (Source)" : "Select Recipient (Target)";
    d3.select("#listLabel").text(labelText);
    
    const maxTotal = listData[0].total;
    const grandTotal = d3.sum(listData, d => d.total);

    const allItem = container.append("div").attr("class", "rank-item all-item").classed("selected", currentSelection === "ALL")
        .on("click", function() {
            container.selectAll(".rank-item").classed("selected", false);
            d3.select(this).classed("selected", true);
            currentSelection = "ALL";
            lockedCountry = null;
            updateCharts("ALL", mode);
        });
    allItem.append("div").attr("class", "rank-info").html(`<div class="rank-num" style="color:#eb2f96">★</div><div class="rank-name">ALL (Global Aggregate)</div><div class="rank-value">${d3.format(".2s")(grandTotal)}</div>`);

    const items = container.selectAll(".normal-item").data(listData).enter().append("div")
        .attr("class", "rank-item normal-item")
        .on("click", function(e, d) {
            container.selectAll(".rank-item").classed("selected", false);
            d3.select(this).classed("selected", true);
            currentSelection = d.name;
            lockedCountry = null;
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
    
    // 🌟 动态更新图表标题
    let titleText = "";
    if (mode === "donor") {
        titleText = (selectedCountry === "ALL") 
            ? "Where did the money go? (Destinations of Top 20 Donors)" 
            : `Where did [${selectedCountry}] send money?`;
    } else {
        titleText = (selectedCountry === "ALL") 
            ? "Where did the money come from? (Sources for Top 10 Recipients)" 
            : `Who gave money to [${selectedCountry}]?`;
    }
    d3.select(".chart-title").text(titleText);

    currentChartData = yearRange.map(year => {
        const obj = { year: year, total: 0 };
        counterparts.forEach(c => obj[c] = 0);
        return obj;
    });

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

    currentChartData.forEach(d => { d.total = d3.sum(counterparts.map(k => d[k])); });

    cachedSeriesData = counterparts.map(key => {
        return {
            key: key,
            values: currentChartData.map(d => {
                let val = d[key];
                if (isNormalized) val = (d.total > 0) ? val / d.total : 0;
                return { year: d.year, value: val };
            })
        };
    });

    if (isNormalized) {
        y.domain([0, 1]);
        svgMain.select(".y-axis").transition().duration(500).call(d3.axisLeft(y).ticks(5, "%"));
    } else {
        const maxVal = d3.max(cachedSeriesData, s => d3.max(s.values, v => v.value)) || 100;
        y.domain([0, maxVal]).nice();
        svgMain.select(".y-axis").transition().duration(500).call(d3.axisLeft(y).ticks(5, "s"));
    }

    redrawMainChart();

    const stripHeight = heightStrip / counterparts.length;
    const strips = svgStrip.selectAll(".strip-row").data(counterparts, d => d);
    const stripsEnter = strips.enter().append("g").attr("class", "strip-row");

    // 🌟 左侧交互区：点击锁定
    stripsEnter.append("rect").attr("class", "hit-area")
        .attr("x", -margin.left).attr("y", -stripHeight/2).attr("width", margin.left).attr("height", stripHeight).attr("fill", "transparent")
        .on("click", (e, d) => {
             e.stopPropagation();
             toggleLock(d);
        })
        .on("mouseover", (e, d) => { if (!lockedCountry) highlight(d); }) 
        .on("mouseout", () => { if (!lockedCountry) unhighlight(); });

    stripsEnter.append("text").attr("class", "strip-label")
        .attr("x", -10).attr("dy", "0.35em").attr("text-anchor", "end")
        .style("font-size", "11px").style("fill", "#333"); 

    const stripsMerge = stripsEnter.merge(strips)
        .attr("transform", (d, i) => `translate(0, ${i * stripHeight + stripHeight/2})`);
    
    // 🌟 注意：右侧色块区域移除了点击事件
        
    stripsMerge.select("text").text(d => d);

    stripsMerge.each(function(countryName) {
        const row = d3.select(this);
        const maxAmt = d3.max(currentChartData, d => d[countryName]);
        const opacityScale = d3.scaleLog().domain([1, maxAmt || 1]).range([0.1, 1]);
        
        const blocks = row.selectAll("rect.data-bar").data(yearRange);
        blocks.enter().append("rect").attr("class", "data-bar").merge(blocks)
            .attr("x", yr => xStrip(yr))
            .attr("y", -stripHeight/2 + 1)
            .attr("width", width / yearRange.length).attr("height", stripHeight - 2)
            .attr("fill", yr => {
                const pt = currentChartData.find(c => c.year === yr);
                return (pt && pt[countryName] > 0) ? colorScale(countryName) : "#eee";
            })
            .attr("opacity", yr => {
                const pt = currentChartData.find(c => c.year === yr);
                const val = pt ? pt[countryName] : 0;
                return (val > 0) ? opacityScale(Math.max(1, val)) : 1; 
            })
            .style("pointer-events", "none"); // 🌟 禁用右侧鼠标响应，保证 Brush 可用
        blocks.exit().remove();
    });
    strips.exit().remove();
    
    svgStrip.select(".x-axis").call(xAxisStrip);
    setupAxisInteraction(svgStrip.select(".x-axis"));
    svgStrip.select(".brush").raise();
}

function redrawMainChart() {
    const area = d3.area().x(d => xMain(d.year)).y0(y(0)).y1(d => y(d.value));

    const layers = svgMain.selectAll(".layer").data(cachedSeriesData, d => d.key);
    layers.enter().append("path").attr("class", "layer")
        .attr("clip-path", "url(#clip)")
        .merge(layers)
        .attr("d", d => area(d.values))
        .attr("fill", d => colorScale(d.key))
        .attr("stroke", "none")
        .attr("fill-opacity", 0.6)
        .on("mouseover", (e, d) => { if (!lockedCountry) highlight(d.key); })
        .on("mouseout", () => { if (!lockedCountry) unhighlight(); });
        // 🌟 移除 click 事件

    layers.exit().remove();
    
    svgMain.on("mousemove", (event) => {
        if (lockedYear) return;
        const [mx] = d3.pointer(event);
        const year = Math.round(xMain.invert(mx));
        if (year < yearRange[0] || year > yearRange[yearRange.length-1]) return;
        updateFocusLines(year);
        drawPie(year, colorScale.domain());
        highlightAxisLabel(year);
    }).on("mouseout", () => {
        if (lockedYear) return;
        focusLineMain.style("opacity", 0);
        focusLineStrip.style("opacity", 0);
        highlightAxisLabel(null);
    });
}

function toggleLock(targetName) {
    if (lockedCountry === targetName) {
        lockedCountry = null;
        unhighlight();
    } else {
        lockedCountry = targetName;
        highlight(targetName);
    }
}

function updateFocusLines(year) {
    const lineXStrip = xStrip(year);
    const lineXMain = xMain(year);
    const [minY, maxY] = xMain.domain();
    
    const lineDash = lockedYear ? "none" : "4 4";
    const lineWidth = lockedYear ? 2 : 1;
    const lineOpacity = 1;

    if (year >= minY && year <= maxY) {
        focusLineMain.style("opacity", lineOpacity)
            .attr("x1", lineXMain).attr("x2", lineXMain)
            .attr("stroke-dasharray", lineDash).attr("stroke-width", lineWidth);
    } else {
        focusLineMain.style("opacity", 0);
    }
    focusLineStrip.style("opacity", lineOpacity)
        .attr("x1", lineXStrip).attr("x2", lineXStrip)
        .attr("stroke-dasharray", lineDash).attr("stroke-width", lineWidth);
}

function drawPie(year, keys) {
    const dataRow = currentChartData.find(d => d.year === year);
    if (!dataRow) return;
    const suffix = lockedYear ? " (Locked)" : "";
    d3.select("#detail-title").text(`${year} Breakdown${suffix}`);
    
    const pieData = keys.map(k => ({ key: k, value: dataRow[k] || 0 })).filter(d => d.value > 0);
    const total = d3.sum(pieData, d => d.value);
    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(pieRadius * 0.5).outerRadius(pieRadius * 0.9);
    const slices = svgPie.selectAll("path").data(pie(pieData), d => d.data.key);
    slices.enter().append("path").attr("class", "pie-slice").merge(slices)
        .attr("d", arc).attr("fill", d => colorScale(d.data.key)).attr("stroke", "#fff").attr("stroke-width", 1)
        .on("mouseover", (e, d) => { if (!lockedCountry) highlight(d.data.key); })
        .on("mouseout", () => { if (!lockedCountry) unhighlight(); })
        .on("click", (e, d) => toggleLock(d.data.key));
    slices.exit().remove();
    pieLabel.text(d3.format(".2s")(total));
    if (total === 0) { pieLabel.text("No Data"); svgPie.selectAll("path").remove(); }
}

function updateLegend(names) {
    const container = d3.select("#legend-container");
    container.html("");
    names.forEach(name => {
        const item = container.append("div").attr("class", "legend-item")
            .on("mouseover", () => { if (!lockedCountry) highlight(name); })
            .on("mouseout", () => { if (!lockedCountry) unhighlight(); })
            .on("click", () => toggleLock(name));
        item.append("div").attr("class", "legend-color").style("background-color", colorScale(name));
        item.append("span").text(name);
    });
}

function highlight(targetName) {
    svgMain.selectAll(".layer").transition().duration(100)
        .attr("fill", d => d.key === targetName ? colorScale(d.key) : "#fafafa") 
        .attr("stroke", d => d.key === targetName ? "#000" : "#ccc")
        .attr("stroke-width", d => d.key === targetName ? 2 : 1)
        .attr("stroke-dasharray", d => d.key === targetName ? "none" : "4 2")
        .attr("fill-opacity", d => d.key === targetName ? 1 : 0.6);
    svgMain.selectAll(".layer").filter(d => d.key === targetName).raise();

    svgStrip.selectAll(".strip-row").each(function(d) {
        const row = d3.select(this);
        const isTarget = (d === targetName);
        row.select("text").classed("locked", isTarget);
        row.select(".hit-area").attr("fill", isTarget ? "#e6f7ff" : "transparent");
        row.selectAll("rect.data-bar").attr("fill", yr => {
            const pt = currentChartData.find(c => c.year === yr);
            if (pt && pt[d] > 0) return isTarget ? colorScale(d) : "#ddd";
            return "#eee";
        });
    });
    d3.selectAll(".legend-item").classed("locked", function() { return d3.select(this).text() === targetName; });
}

function unhighlight() {
    svgMain.selectAll(".layer").transition().duration(200)
        .attr("fill", d => colorScale(d.key))
        .attr("stroke", "none").attr("stroke-dasharray", "none").attr("fill-opacity", 0.6);
    svgStrip.selectAll(".strip-row").each(function(d) {
        const row = d3.select(this);
        row.select("text").classed("locked", false);
        row.select(".hit-area").attr("fill", "transparent");
        row.selectAll("rect.data-bar").attr("fill", yr => {
            const pt = currentChartData.find(c => c.year === yr);
            return (pt && pt[d] > 0) ? colorScale(d) : "#eee";
        });
    });
    d3.selectAll(".legend-item").classed("locked", false);
}