/**
 * Aid Timeline Explorer - Interactive Time Series Analysis
 * 
 * Visualizes aid flows over time (1973-2013) with multiple linked views:
 * - Main area/stacked chart: trends over time
 * - Strip chart: heatmap by year and country
 * - Pie chart: composition at selected year
 * Supports brush selection, hover focus, and year-locking.
 */

// Margins and dimensions
const MARGIN = { top: 20, right: 30, bottom: 30, left: 160 };
const WIDTH = 850 - MARGIN.left - MARGIN.right;
const HEIGHT_MAIN = 350 - MARGIN.top - MARGIN.bottom;
const HEIGHT_STRIP = 180 - MARGIN.top - MARGIN.bottom;
const PIE_WIDTH = 180;
const PIE_HEIGHT = 180;
const PIE_RADIUS = Math.min(PIE_WIDTH, PIE_HEIGHT) / 2;

// Create SVG elements
const svgMain = d3.select("#main-chart").append("svg")
  .attr("width", WIDTH + MARGIN.left + MARGIN.right)
  .attr("height", HEIGHT_MAIN + MARGIN.top + MARGIN.bottom)
  .append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

svgMain.append("defs").append("clipPath").attr("id", "clip")
  .append("rect").attr("width", WIDTH).attr("height", HEIGHT_MAIN);

const svgStrip = d3.select("#strip-chart").append("svg")
  .attr("width", WIDTH + MARGIN.left + MARGIN.right)
  .attr("height", HEIGHT_STRIP + MARGIN.top + MARGIN.bottom)
  .append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

const svgPie = d3.select("#pie-chart").append("svg")
  .attr("width", PIE_WIDTH)
  .attr("height", PIE_HEIGHT)
  .append("g").attr("transform", `translate(${PIE_WIDTH/2},${PIE_HEIGHT/2})`);

const pieLabel = svgPie.append("text")
  .attr("text-anchor", "middle")
  .attr("dy", "0.35em")
  .style("font-size", "12px")
  .style("font-weight", "bold")
  .style("fill", "#333");

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// Focus lines for hover/lock states
const focusLineMain = svgMain.append("line")
  .attr("class", "hover-line")
  .attr("y1", 0)
  .attr("y2", HEIGHT_MAIN)
  .attr("stroke", "#ff4d4f")
  .attr("stroke-width", 1)
  .attr("stroke-dasharray", "4 4")
  .style("opacity", 0)
  .style("pointer-events", "none");

const focusLineStrip = svgStrip.append("line")
  .attr("class", "hover-line")
  .attr("y1", 0)
  .attr("y2", HEIGHT_STRIP)
  .attr("stroke", "#ff4d4f")
  .attr("stroke-width", 1)
  .attr("stroke-dasharray", "4 4")
  .style("opacity", 0)
  .style("pointer-events", "none");

// State variables
let rawData = [];
let topDonors = [];
let topRecipients = [];
let yearRange = [];
let xMain = null;
let xStrip = null;
let y = null;
let colorScale = null;

let currentSelection = "ALL";
let isNormalized = false;
let currentChartData = [];
let brush = null;
let cachedSeriesData = [];
let lockedCountry = null;
let lockedYear = null;

/**
 * Load and initialize data.
 */
d3.csv("aiddata-countries-only.csv").then(data => {
  // Clean data
  rawData = data.map(d => ({
    donor: d.donor,
    recipient: d.recipient,
    amount: +d.commitment_amount_usd_constant,
    year: +d.year
  })).filter(d => d.amount > 0 && d.year);

  /**
   * Calculate totals for a given key (donor or recipient).
   */
  const calcTotals = (key) => d3.rollups(
    rawData,
    v => d3.sum(v, d => d.amount),
    d => d[key]
  ).map(d => ({ name: d[0], total: d[1] }))
    .sort((a, b) => b.total - a.total);

  // Get top 20 donors and top 10 recipients
  topDonors = calcTotals("donor").slice(0, 20);
  topRecipients = calcTotals("recipient").slice(0, 10);

  // Filter to top countries
  const donorSet = new Set(topDonors.map(d => d.name));
  const recipSet = new Set(topRecipients.map(d => d.name));
  rawData = rawData.filter(d => donorSet.has(d.donor) && recipSet.has(d.recipient));

  // Get year range
  const extent = d3.extent(rawData, d => d.year);
  yearRange = d3.range(extent[0], extent[1] + 1);

  // Set up scales
  xStrip = d3.scaleLinear().domain(extent).range([0, WIDTH]);
  xMain = d3.scaleLinear().domain(extent).range([0, WIDTH]);
  y = d3.scaleLinear().range([HEIGHT_MAIN, 0]);
  colorScale = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3));

  // Draw axes
  const xAxisMain = d3.axisBottom(xMain).tickFormat(d3.format("d"));
  const xAxisStrip = d3.axisBottom(xStrip).tickFormat(d3.format("d"));

  svgMain.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${HEIGHT_MAIN})`)
    .call(xAxisMain);

  svgMain.append("g").attr("class", "y-axis");

  const axisGroup = svgStrip.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${HEIGHT_STRIP})`)
    .call(xAxisStrip);

  setupAxisInteraction(axisGroup);

  // Set up brush
  brush = d3.brushX()
    .extent([[0, 0], [WIDTH, HEIGHT_STRIP]])
    .on("brush end", brushed);

  const brushGroup = svgStrip.append("g").attr("class", "brush").call(brush);

  // Brush overlay interactions
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

  // View mode and normalization controls
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
}).catch(err => {
  console.error("Error loading CSV:", err);
  alert("Error loading aiddata-countries-only.csv.");
});

/**
 * Handle brush selection on strip chart.
 */
function brushed(event) {
  const selection = event.selection;
  if (selection) {
    xMain.domain([xStrip.invert(selection[0]), xStrip.invert(selection[1])]);
  } else {
    xMain.domain(xStrip.domain());
  }
  svgMain.select(".x-axis").call(d3.axisBottom(xMain).tickFormat(d3.format("d")));
  redrawMainChart();
}

/**
 * Set up interactive behaviors for axis labels.
 */
function setupAxisInteraction(g) {
  g.selectAll(".tick text")
    .style("cursor", "pointer")
    .style("font-size", "11px")
    .style("transition", "all 0.2s")
    .on("mouseover", function() {
      if (!d3.select(this).classed("locked-label")) {
        d3.select(this).style("fill", "#1890ff").style("font-weight", "bold");
      }
    })
    .on("mouseout", function() {
      if (!d3.select(this).classed("locked-label")) {
        d3.select(this).style("fill", "currentColor").style("font-weight", "normal");
      }
    })
    .on("click", (event, d) => toggleYearLock(d));
}

/**
 * Highlight or unhighlight an axis label.
 */
function highlightAxisLabel(year) {
  d3.selectAll(".x-axis .tick text")
    .style("fill", "currentColor")
    .style("font-weight", "normal")
    .classed("locked-label", false);

  if (year !== null) {
    d3.selectAll(".x-axis .tick").filter(d => d === year).select("text")
      .style("fill", "#ff4d4f")
      .style("font-weight", "bold")
      .style("font-size", "13px")
      .classed("locked-label", true);
  }
}

/**
 * Toggle year lock state.
 */
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

/**
 * Update side list of donors or recipients.
 */
function updateSideList(mode) {
  const container = d3.select("#rankingList");
  container.html("");

  const listData = (mode === "donor") ? topDonors : topRecipients;
  const labelText = (mode === "donor") ? "Select Donor (Source)" : "Select Recipient (Target)";
  d3.select("#listLabel").text(labelText);

  const maxTotal = listData[0].total;
  const grandTotal = d3.sum(listData, d => d.total);

  // All option
  const allItem = container.append("div")
    .attr("class", "rank-item all-item")
    .classed("selected", currentSelection === "ALL")
    .on("click", function() {
      container.selectAll(".rank-item").classed("selected", false);
      d3.select(this).classed("selected", true);
      currentSelection = "ALL";
      lockedCountry = null;
      updateCharts("ALL", mode);
    });

  allItem.append("div")
    .attr("class", "rank-info")
    .html(`<div class="rank-num" style="color:#eb2f96">★</div><div class="rank-name">ALL (Global Aggregate)</div><div class="rank-value">${d3.format(".2s")(grandTotal)}</div>`);

  // Individual items
  const items = container.selectAll(".normal-item")
    .data(listData)
    .enter()
    .append("div")
    .attr("class", "rank-item normal-item")
    .on("click", function(e, d) {
      container.selectAll(".rank-item").classed("selected", false);
      d3.select(this).classed("selected", true);
      currentSelection = d.name;
      lockedCountry = null;
      updateCharts(d.name, mode);
    });

  items.append("div")
    .attr("class", "rank-bar-bg")
    .style("width", d => (d.total / maxTotal * 100) + "%");

  items.append("div")
    .attr("class", "rank-info")
    .html((d, i) => `<div class="rank-num">${i + 1}</div><div class="rank-name" title="${d.name}">${d.name}</div><div class="rank-value">${d3.format(".2s")(d.total)}</div>`);

  updateCharts(currentSelection, mode);
}

/**
 * Update charts based on selected country and view mode.
 */
function updateCharts(selectedCountry, mode) {
  const counterpartsData = (mode === "donor") ? topRecipients : topDonors;
  const counterparts = counterpartsData.map(d => d.name);
  colorScale.domain(counterparts);
  updateLegend(counterparts);

  // Build time-series data
  currentChartData = yearRange.map(year => {
    const obj = { year: year, total: 0 };
    counterparts.forEach(c => obj[c] = 0);
    return obj;
  });

  rawData.forEach(d => {
    let match = false;
    let targetKey = "";

    if (selectedCountry === "ALL") {
      if (mode === "donor" && counterparts.includes(d.recipient)) {
        match = true;
        targetKey = d.recipient;
      } else if (mode === "recipient" && counterparts.includes(d.donor)) {
        match = true;
        targetKey = d.donor;
      }
    } else {
      if (mode === "donor" && d.donor === selectedCountry && counterparts.includes(d.recipient)) {
        match = true;
        targetKey = d.recipient;
      } else if (mode === "recipient" && d.recipient === selectedCountry && counterparts.includes(d.donor)) {
        match = true;
        targetKey = d.donor;
      }
    }

    if (match) {
      const idx = d.year - yearRange[0];
      if (currentChartData[idx]) currentChartData[idx][targetKey] += d.amount;
    }
  });

  // Calculate totals
  currentChartData.forEach(d => {
    d.total = d3.sum(counterparts.map(k => d[k]));
  });

  // Prepare stacked data
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

  // Update y-axis scale
  if (isNormalized) {
    y.domain([0, 1]);
    svgMain.select(".y-axis").transition().duration(500)
      .call(d3.axisLeft(y).ticks(5, "%"));
  } else {
    const maxVal = d3.max(cachedSeriesData, s => d3.max(s.values, v => v.value)) || 100;
    y.domain([0, maxVal]).nice();
    svgMain.select(".y-axis").transition().duration(500)
      .call(d3.axisLeft(y).ticks(5, "s"));
  }

  redrawMainChart();
  renderStripPlot(counterparts);
}

/**
 * Redraw the main area chart.
 */
function redrawMainChart() {
  const area = d3.area()
    .x(d => xMain(d.year))
    .y0(y(0))
    .y1(d => y(d.value));

  const layers = svgMain.selectAll(".layer").data(cachedSeriesData, d => d.key);
  layers.enter().append("path")
    .attr("class", "layer")
    .attr("clip-path", "url(#clip)")
    .merge(layers)
    .attr("d", d => area(d.values))
    .attr("fill", d => colorScale(d.key))
    .attr("stroke", "none")
    .attr("fill-opacity", 0.6)
    .on("mouseover", (e, d) => {
      if (!lockedCountry) highlight(d.key);
    })
    .on("mouseout", () => {
      if (!lockedCountry) unhighlight();
    });

  layers.exit().remove();

  svgMain.on("mousemove", (event) => {
    if (lockedYear) return;
    const [mx] = d3.pointer(event);
    const year = Math.round(xMain.invert(mx));
    if (year < yearRange[0] || year > yearRange[yearRange.length - 1]) return;
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

/**
 * Render the strip chart (heatmap of years × countries).
 */
function renderStripPlot(counterparts) {
  const containerW = d3.select("#strip-chart").node().clientWidth;
  const containerH = d3.select("#strip-chart").node().clientHeight;
  const svgStrip = d3.select("#strip-chart svg");
  svgStrip.selectAll("*:not(.brush)").remove();

  const m = MARGIN;
  const innerW = containerW - m.left - m.right;
  const rowMin = 14;
  const innerH = Math.max(containerH - m.top - m.bottom, counterparts.length * (rowMin + 2));
  const svgH = innerH + m.top + m.bottom;

  svgStrip.attr("height", svgH);
  const g = svgStrip.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const years = yearRange;
  const xBand = d3.scaleBand().domain(years).range([0, innerW]).paddingInner(0);
  const xLinear = d3.scaleLinear().domain([yearRange[0], yearRange[yearRange.length - 1]]).range([0, innerW]);

  const y = d3.scaleBand().domain(counterparts).range([0, innerH]).padding(0.12);
  const rowH = y.bandwidth();
  const yearW = xBand.bandwidth();

  // Build cells
  const cells = [];
  currentChartData.forEach(d => {
    counterparts.forEach(c => {
      if (d[c] > 0) cells.push({ year: d.year, country: c, val: d[c] });
    });
  });

  const maxVal = d3.max(cells, d => d.val) || 1;
  const opacityScale = d3.scaleLog().domain([100, maxVal]).range([0.2, 1]);

  g.selectAll(".strip-cell").data(cells).enter().append("rect")
    .attr("class", "strip-cell")
    .attr("x", d => xBand(d.year))
    .attr("y", d => y(d.country))
    .attr("width", yearW)
    .attr("height", rowH)
    .attr("fill", d => colorScale(d.country))
    .attr("opacity", d => opacityScale(Math.max(1, d.val)))
    .style("pointer-events", "none");

  // Y-axis with country names
  const yAxis = d3.axisLeft(y)
    .tickSize(0)
    .tickPadding(6);

  const yG = g.append("g").attr("class", "strip-row").call(yAxis);
  yG.selectAll("text")
    .style("font-size", `${Math.min(11, Math.max(9, rowH))}px`)
    .each(function(d) {
      d3.select(this).append("title").text(d);
    })
    .on("mouseover", (e, d) => {
      lockedCountry = d;
      highlight(d);
    })
    .on("mouseout", () => {
      lockedCountry = null;
      unhighlight();
    })
    .on("click", (e, d) => {
      lockedCountry = lockedCountry === d ? null : d;
      highlight(lockedCountry || colorScale.domain()[0]);
    });

  // X-axis with years
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xLinear).tickFormat(d3.format("d")));

  // Brush on top
  svgStrip.select(".brush").raise();
}

/**
 * Update focus lines to show year position.
 */
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
      .attr("stroke-dasharray", lineDash)
      .attr("stroke-width", lineWidth);
  } else {
    focusLineMain.style("opacity", 0);
  }

  focusLineStrip.style("opacity", lineOpacity)
    .attr("x1", lineXStrip).attr("x2", lineXStrip)
    .attr("stroke-dasharray", lineDash)
    .attr("stroke-width", lineWidth);
}

/**
 * Draw pie chart for selected year.
 */
function drawPie(year, keys) {
  const dataRow = currentChartData.find(d => d.year === year);
  if (!dataRow) return;

  const suffix = lockedYear ? " (Locked)" : "";
  d3.select("#detail-title").text(`${year} Breakdown${suffix}`);

  const pieData = keys
    .map(k => ({ key: k, value: dataRow[k] || 0 }))
    .filter(d => d.value > 0);

  const total = d3.sum(pieData, d => d.value);
  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc()
    .innerRadius(PIE_RADIUS * 0.5)
    .outerRadius(PIE_RADIUS * 0.9);

  const slices = svgPie.selectAll("path").data(pie(pieData), d => d.data.key);
  slices.enter().append("path")
    .attr("class", "pie-slice")
    .merge(slices)
    .attr("d", arc)
    .attr("fill", d => colorScale(d.data.key))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .on("mouseover", (e, d) => {
      if (!lockedCountry) highlight(d.data.key);
    })
    .on("mouseout", () => {
      if (!lockedCountry) unhighlight();
    })
    .on("click", (e, d) => {
      lockedCountry = lockedCountry === d.data.key ? null : d.data.key;
      highlight(lockedCountry || colorScale.domain()[0]);
    });

  slices.exit().remove();

  pieLabel.text(total === 0 ? "No Data" : d3.format(".2s")(total));
  if (total === 0) svgPie.selectAll("path").remove();
}

/**
 * Update legend of countries.
 */
function updateLegend(names) {
  const container = d3.select("#legend-container");
  container.html("");

  names.forEach(name => {
    const item = container.append("div")
      .attr("class", "legend-item")
      .on("mouseover", () => {
        if (!lockedCountry) highlight(name);
      })
      .on("mouseout", () => {
        if (!lockedCountry) unhighlight();
      })
      .on("click", () => {
        lockedCountry = lockedCountry === name ? null : name;
        highlight(lockedCountry || colorScale.domain()[0]);
      });

    item.append("div")
      .attr("class", "legend-color")
      .style("background-color", colorScale(name));

    item.append("span").text(name);
  });
}

/**
 * Highlight a country across all views.
 */
function highlight(targetName) {
  svgMain.selectAll(".layer").transition().duration(100)
    .attr("fill", d => d.key === targetName ? colorScale(d.key) : "#fafafa")
    .attr("stroke", d => d.key === targetName ? "#000" : "#ccc")
    .attr("stroke-width", d => d.key === targetName ? 2 : 1)
    .attr("stroke-dasharray", d => d.key === targetName ? "none" : "4 2")
    .attr("fill-opacity", d => d.key === targetName ? 1 : 0.6);

  svgMain.selectAll(".layer").filter(d => d.key === targetName).raise();

  d3.selectAll(".legend-item").classed("locked", function() {
    return d3.select(this).text() === targetName;
  });
}

/**
 * Unhighlight all countries.
 */
function unhighlight() {
  svgMain.selectAll(".layer").transition().duration(200)
    .attr("fill", d => colorScale(d.key))
    .attr("stroke", "none")
    .attr("stroke-dasharray", "none")
    .attr("fill-opacity", 0.6);

  d3.selectAll(".legend-item").classed("locked", false);
}
