// vis2.js – Visualization 2: Aid flows by purpose (Top 20 donors, Top 10 recipients, Top 5 purposes)

const mainWidth  = 1100;
const mainHeight = 620;
// 右侧 margin 加 80：230 -> 310
const mainMargin = { top: 40, right: 310, bottom: 40, left: 230 };

const innerWidth  = mainWidth  - mainMargin.left - mainMargin.right;
const innerHeight = mainHeight - mainMargin.top  - mainMargin.bottom;

const donorX     = 0;
const recipientX = innerWidth;

const svg = d3.select("#mainChart")
  .append("svg")
  .attr("width", mainWidth)
  .attr("height", mainHeight);

const g = svg.append("g")
  .attr("transform", `translate(${mainMargin.left},${mainMargin.top})`);

// Separate layers for links and nodes
const linkLayer = g.append("g").attr("class", "links-layer");
const nodeLayer = g.append("g").attr("class", "nodes-layer");

const defs = svg.append("defs");
const tooltip = d3.select("#tooltip");

// Background rect for reset on hover-out
const bgRect = g.insert("rect", ":first-child")
  .attr("x", -40)
  .attr("y", -40)
  .attr("width", innerWidth + 80)
  .attr("height", innerHeight + 80)
  .attr("fill", "transparent")
  .style("pointer-events", "all")
  .on("mouseover", () => {
    resetLinks();
  });

// Pie chart sizes
const pairPieWidth  = 400;
const pairPieHeight = 300;
const countryPieWidth  = 400;
const countryPieHeight = 300;

const pairPieSvg = d3.select("#pairPie")
  .append("svg")
  .attr("width", pairPieWidth)
  .attr("height", pairPieHeight);

const countryPieSvg = d3.select("#countryPie")
  .append("svg")
  .attr("width", countryPieWidth)
  .attr("height", countryPieHeight);

// 饼图往左挪一点
const pairPieG = pairPieSvg.append("g")
  .attr("transform", `translate(${pairPieWidth / 2 - 80}, ${pairPieHeight / 2})`);

const countryPieG = countryPieSvg.append("g")
  .attr("transform", `translate(${countryPieWidth / 2 - 80}, ${countryPieHeight / 2})`);

// 饼图旁边的图例（靠右）
const pairLegendG = pairPieSvg.append("g")
  .attr("class", "pie-legend pair-legend")
  .attr("transform", `translate(${pairPieWidth - 120}, 40)`);

const countryLegendG = countryPieSvg.append("g")
  .attr("class", "pie-legend country-legend")
  .attr("transform", `translate(${countryPieWidth - 120}, 40)`);

const pie = d3.pie()
  .value(d => d.value)
  .sort(null);

const arcPair = d3.arc()
  .innerRadius(0)
  .outerRadius(Math.min(pairPieWidth, pairPieHeight) / 2 - 40);

const arcCountry = d3.arc()
  .innerRadius(0)
  .outerRadius(Math.min(countryPieWidth, countryPieHeight) / 2 - 40);

const pairDonorSelect     = document.getElementById("pairDonorSelect");
const pairRecipientSelect = document.getElementById("pairRecipientSelect");
const countrySelect       = document.getElementById("countrySelect");
const countryModeInputs   = document.getElementsByName("countryMode");

const formatAmount = d3.format(",.0f");
const formatShort  = d3.format(".2s");

const BASE_OPACITY   = 0.70;
const HILITE_OPACITY = 0.98;
const NODE_RADIUS    = 7;

// 百分比标签阈值（<5%的扇形不显示文字，减少遮挡）
const LABEL_THRESHOLD = 0.05;

// Global state
let donorsOrdered = [];
let recipientsOrdered = [];
let purposesOrdered = [];
let pairMap = new Map();       // key: donor||recipient -> { donor, recipient, total, purposes[] }
let edgesByPurpose = [];       // [{donor, recipient, purpose, value}]
let links;                     // main link selection
let nodeGroups;                // main node groups (both sides)
let purposeColorScale;         // color for purposes
let selected = null;           // { name, role: "donor" | "recipient" } or null

d3.csv("aiddata-countries-only.csv").then(raw => {
  // Clean data
  const data = raw
    .filter(d =>
      d.donor &&
      d.recipient &&
      d.commitment_amount_usd_constant &&
      d.coalesced_purpose_name
    )
    .map(d => ({
      donor: d.donor,
      recipient: d.recipient,
      amount: +d.commitment_amount_usd_constant,
      purpose: d.coalesced_purpose_name,
      year: +d.year
    }))
    .filter(d => d.amount > 0);

  // 1) Top 20 donors / top 10 recipients (overall amounts)
  let donorTotals = d3.rollups(
    data,
    v => d3.sum(v, d => d.amount),
    d => d.donor
  ).sort((a, b) => d3.descending(a[1], b[1]));

  let recipientTotals = d3.rollups(
    data,
    v => d3.sum(v, d => d.amount),
    d => d.recipient
  ).sort((a, b) => d3.descending(a[1], b[1]));

  donorsOrdered     = donorTotals.slice(0, 20).map(d => d[0]);
  recipientsOrdered = recipientTotals.slice(0, 10).map(d => d[0]);

  const topDonorSet     = new Set(donorsOrdered);
  const topRecipientSet = new Set(recipientsOrdered);

  // Restrict to these donors/recipients
  let filtered = data.filter(d =>
    topDonorSet.has(d.donor) && topRecipientSet.has(d.recipient)
  );

  // 2) Within this subset, find top 5 purposes
  let purposeTotals = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.amount),
    d => d.purpose
  ).sort((a, b) => d3.descending(a[1], b[1]));

  purposesOrdered = purposeTotals.slice(0, 5).map(d => d[0]);
  const topPurposeSet = new Set(purposesOrdered);

  // Keep only top 5 purposes
  filtered = filtered.filter(d => topPurposeSet.has(d.purpose));

  // Recompute donor / recipient totals on this filtered data
  donorTotals = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.amount),
    d => d.donor
  ).sort((a, b) => d3.descending(a[1], b[1]));

  recipientTotals = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.amount),
    d => d.recipient
  ).sort((a, b) => d3.descending(a[1], b[1]));

  donorsOrdered     = donorTotals.map(d => d[0]);
  recipientsOrdered = recipientTotals.map(d => d[0]);

  // 3) Aggregate donor-recipient-purpose
  const roll = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.amount),
    d => d.donor,
    d => d.recipient,
    d => d.purpose
  );

  edgesByPurpose = [];
  roll.forEach(([donor, recs]) => {
    recs.forEach(([recipient, purposes]) => {
      purposes.forEach(([purpose, value]) => {
        edgesByPurpose.push({ donor, recipient, purpose, value });
      });
    });
  });

  // 4) Build pairMap: for each donor–recipient, sum total and keep per-purpose breakdown
  pairMap = new Map();
  edgesByPurpose.forEach(d => {
    const key = d.donor + "||" + d.recipient;
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        donor: d.donor,
        recipient: d.recipient,
        total: 0,
        purposes: []
      });
    }
    const obj = pairMap.get(key);
    obj.total += d.value;
    obj.purposes.push({ purpose: d.purpose, value: d.value });
  });

  // Merge same purpose within each pair and sort by value
  pairMap.forEach(obj => {
    const merged = d3.rollups(
      obj.purposes,
      v => d3.sum(v, d => d.value),
      d => d.purpose
    ).map(([purpose, value]) => ({ purpose, value }));
    merged.sort((a, b) => d3.descending(a.value, b.value));
    obj.purposes = merged;
  });

  const pairsArray = Array.from(pairMap.values());

  // 5) Width scale based on pair totals
  const totalExtent = d3.extent(pairsArray, d => d.total);
  const minT = totalExtent[0] || 0;
  const maxT = totalExtent[1] || 1;

  const widthScale = d3.scaleSqrt()
    .domain([minT, maxT])
    .range([1.5, 6]);

  // 6) Purpose color scale – nicer 5-color palette
  const palette = [
    "#66c2a5", // green-blue
    "#fc8d62", // orange
    "#8da0cb", // blue-purple
    "#e78ac3", // pink
    "#a6d854"  // yellow-green
  ];

  purposeColorScale = d3.scaleOrdinal()
    .domain(purposesOrdered)
    .range(palette.slice(0, purposesOrdered.length));

  // 7) Node positions and info
  const donorScale = d3.scaleBand()
    .domain(donorsOrdered)
    .range([0, innerHeight])
    .padding(0.2);

  const recipientScale = d3.scaleBand()
    .domain(recipientsOrdered)
    .range([0, innerHeight])
    .padding(0.2);

  const donorNodeInfo = new Map();
  donorsOrdered.forEach(name => {
    const cy = donorScale(name) + donorScale.bandwidth() / 2;
    donorNodeInfo.set(name, { x: donorX, y: cy, r: NODE_RADIUS });
  });

  const recipientNodeInfo = new Map();
  recipientsOrdered.forEach(name => {
    const cy = recipientScale(name) + recipientScale.bandwidth() / 2;
    recipientNodeInfo.set(name, { x: recipientX, y: cy, r: NODE_RADIUS });
  });

  const donorData     = donorsOrdered.map(name => ({ name, role: "donor" }));
  const recipientData = recipientsOrdered.map(name => ({ name, role: "recipient" }));

  // 8) Create gradients for each pair edge
  pairsArray.forEach(pair => {
    const infoDonor = donorNodeInfo.get(pair.donor);
    const infoRec   = recipientNodeInfo.get(pair.recipient);
    if (!infoDonor || !infoRec) return;

    const x1 = infoDonor.x + infoDonor.r + 4;
    const y1 = infoDonor.y;
    const x2 = infoRec.x   - infoRec.r - 4;
    const y2 = infoRec.y;

    const gradId = `grad-${pair.donor.replace(/\s+/g,"_")}-${pair.recipient.replace(/\s+/g,"_")}`;
    const lg = defs.append("linearGradient")
      .attr("id", gradId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", mainMargin.left + x1)
      .attr("y1", mainMargin.top  + y1)
      .attr("x2", mainMargin.left + x2)
      .attr("y2", mainMargin.top  + y2);

    const total = pair.total;
    let offset = 0;
    pair.purposes.forEach(p => {
      const frac = p.value / total;
      const next = offset + frac;
      const color = purposeColorScale(p.purpose);
      lg.append("stop")
        .attr("offset", (offset * 100) + "%")
        .attr("stop-color", color);
      lg.append("stop")
        .attr("offset", (next * 100) + "%")
        .attr("stop-color", color);
      offset = next;
    });
  });

  // 9) Draw links
  links = linkLayer.selectAll(".link")
    .data(pairsArray, d => d.donor + "||" + d.recipient)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("x1", d => donorNodeInfo.get(d.donor).x + donorNodeInfo.get(d.donor).r + 4)
    .attr("y1", d => donorNodeInfo.get(d.donor).y)
    .attr("x2", d => recipientNodeInfo.get(d.recipient).x - recipientNodeInfo.get(d.recipient).r - 4)
    .attr("y2", d => recipientNodeInfo.get(d.recipient).y)
    .attr("stroke", d => {
      const gradId = `grad-${d.donor.replace(/\s+/g,"_")}-${d.recipient.replace(/\s+/g,"_")}`;
      return `url(#${gradId})`;
    })
    .attr("stroke-width", d => widthScale(d.total))
    .style("stroke-opacity", BASE_OPACITY)
    .on("mouseover", (event, d) => {
      const lines = [
        `Donor: ${d.donor}`,
        `Recipient: ${d.recipient}`,
        `Total: $${formatAmount(d.total)}`
      ];
      d.purposes.forEach(p => {
        const pct = ((p.value / d.total) * 100).toFixed(1);
        lines.push(`${p.purpose}: $${formatAmount(p.value)} (${pct}%)`);
      });
      tooltip
        .style("opacity", 1)
        .html(lines.join("<br>"))
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
      resetLinks();
    })
    .on("click", (event, d) => {
      // Clicking an edge updates the pair-level pie only
      pairDonorSelect.value     = d.donor;
      pairRecipientSelect.value = d.recipient;
      updatePairPie(d.donor, d.recipient);
    });

  // 10) Draw nodes – donors on the left, recipients on the right
  const donorGroup = nodeLayer.selectAll(".donor-node")
    .data(donorData)
    .enter()
    .append("g")
    .attr("class", "node-group donor-node")
    .attr("transform", d => {
      const info = donorNodeInfo.get(d.name);
      return `translate(${info.x},${info.y})`;
    });

  donorGroup.append("circle")
    .attr("class", "node-circle")
    .attr("r", NODE_RADIUS)
    .on("click", (event, d) => {
      const enabled = toggleSelection(d.name, "donor");
      if (enabled) {
        countrySelect.value = d.name;
        document.querySelector("input[name='countryMode'][value='donor']").checked = true;
        updateCountryPie(d.name, "donor");
      } else {
        clearCountryPie();
      }
    });

  donorGroup.append("text")
    .attr("class", "node-label")
    .attr("x", -110)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(d => `#${donorsOrdered.indexOf(d.name) + 1} ${d.name}`)
    .on("click", (event, d) => {
      const enabled = toggleSelection(d.name, "donor");
      if (enabled) {
        countrySelect.value = d.name;
        document.querySelector("input[name='countryMode'][value='donor']").checked = true;
        updateCountryPie(d.name, "donor");
      } else {
        clearCountryPie();
      }
    });

  const recipientGroup = nodeLayer.selectAll(".recipient-node")
    .data(recipientData)
    .enter()
    .append("g")
    .attr("class", "node-group recipient-node")
    .attr("transform", d => {
      const info = recipientNodeInfo.get(d.name);
      return `translate(${info.x},${info.y})`;
    });

  recipientGroup.append("circle")
    .attr("class", "node-circle")
    .attr("r", NODE_RADIUS)
    .on("click", (event, d) => {
      const enabled = toggleSelection(d.name, "recipient");
      if (enabled) {
        countrySelect.value = d.name;
        document.querySelector("input[name='countryMode'][value='recipient']").checked = true;
        updateCountryPie(d.name, "recipient");
      } else {
        clearCountryPie();
      }
    });

  recipientGroup.append("text")
    .attr("class", "node-label")
    .attr("x", 10)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(d => `#${recipientsOrdered.indexOf(d.name) + 1} ${d.name}`)
    .on("click", (event, d) => {
      const enabled = toggleSelection(d.name, "recipient");
      if (enabled) {
        countrySelect.value = d.name;
        document.querySelector("input[name='countryMode'][value='recipient']").checked = true;
        updateCountryPie(d.name, "recipient");
      } else {
        clearCountryPie();
      }
    });

  nodeGroups = nodeLayer.selectAll(".node-group");

  // 11) 主图右侧 purpose legend（自动换行）
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${mainWidth - mainMargin.right + 80}, ${mainMargin.top})`);

  legend.append("text")
    .text("Top 5 purposes")
    .attr("font-weight", "600")
    .attr("y", 0);

  const mainLegendItemHeight = 26;

  purposesOrdered.forEach((p, i) => {
    const gL = legend.append("g")
      .attr("transform", `translate(0, ${20 + i * mainLegendItemHeight})`);

    gL.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", purposeColorScale(p));

    const text = gL.append("text")
      .attr("x", 18)
      .attr("y", 0)
      .attr("dy", "0.9em")
      .style("font-size", "10px")
      .text(p);

    wrapText(text, 150);
  });

  // 12) 饼图旁边的图例（pair + country），使用同一套颜色并自动换行
  drawPieLegend(pairLegendG, 100);
  drawPieLegend(countryLegendG, 100);

  // 13) Initialize pair and country selectors
  donorsOrdered.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    pairDonorSelect.appendChild(opt);
  });

  recipientsOrdered.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    pairRecipientSelect.appendChild(opt);
  });

  // countrySelect: union of donors + recipients
  const allCountries = new Set();
  donorsOrdered.forEach(d => allCountries.add(d));
  recipientsOrdered.forEach(r => allCountries.add(r));
  Array.from(allCountries).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });

  // Default: overview, pies 空
  updateSelection();

  // Set up control listeners
  pairDonorSelect.addEventListener("change", () => {
    const donor     = pairDonorSelect.value;
    const recipient = pairRecipientSelect.value;
    if (donor && recipient) {
      updatePairPie(donor, recipient);
    }
  });

  pairRecipientSelect.addEventListener("change", () => {
    const donor     = pairDonorSelect.value;
    const recipient = pairRecipientSelect.value;
    if (donor && recipient) {
      updatePairPie(donor, recipient);
    }
  });

  countryModeInputs.forEach(radio => {
    radio.addEventListener("change", () => {
      const country = countrySelect.value;
      if (!country) return;
      const mode = document.querySelector("input[name='countryMode']:checked").value;
      updateCountryPie(country, mode);
    });
  });

  countrySelect.addEventListener("change", () => {
    const country = countrySelect.value;
    if (!country) return;
    const mode = document.querySelector("input[name='countryMode']:checked").value;
    updateCountryPie(country, mode);
  });

}).catch(err => {
  console.error("Error loading CSV:", err);
  alert("Error loading aiddata-countries-only.csv. Make sure the file is in the same folder and served over HTTP (not file://).");
});

// === Selection / highlighting for main network ===

function toggleSelection(name, role) {
  if (selected && selected.name === name && selected.role === role) {
    selected = null;
    updateSelection();
    return false;
  } else {
    selected = { name, role };
    updateSelection();
    return true;
  }
}

function updateSelection() {
  if (!links) return;

  if (!selected) {
    links
      .style("display", null)
      .style("stroke-opacity", BASE_OPACITY);

    if (nodeGroups) {
      nodeGroups
        .style("display", null);
      nodeGroups.selectAll(".node-label").classed("highlight", false);
      nodeGroups.selectAll(".node-circle").classed("highlight", false);
    }
    return;
  }

  const { name, role } = selected;

  links
    .style("display", d =>
      role === "donor" ? (d.donor === name ? null : "none")
                       : (d.recipient === name ? null : "none")
    )
    .style("stroke-opacity", HILITE_OPACITY);

  const neighbors = new Set();
  links.data().forEach(e => {
    if (role === "donor" && e.donor === name) {
      neighbors.add(e.recipient);
    } else if (role === "recipient" && e.recipient === name) {
      neighbors.add(e.donor);
    }
  });

  if (nodeGroups) {
    nodeGroups
      .style("display", null);

    nodeGroups.selectAll(".node-label")
      .classed("highlight", d =>
        (d.name === name && d.role === role) ||
        (d.role !== role && neighbors.has(d.name))
      );

    nodeGroups.selectAll(".node-circle")
      .classed("highlight", d =>
        (d.name === name && d.role === role) ||
        (d.role !== role && neighbors.has(d.name))
      );
  }
}

function resetLinks() {
  updateSelection();
}

// === 饼图旁边的图例（复用主色 + 自动换行） ===

function drawPieLegend(gLegend, maxWidth) {
  if (!gLegend || !purposesOrdered || !purposeColorScale) return;

  gLegend.selectAll("*").remove();

  gLegend.append("text")
    .attr("font-weight", "600")
    .attr("y", 0)
    .style("font-size", "11px")
    .text("Purposes");

  // 行高从 16 -> 24，给多行文字留空间
  const itemHeight = 24;

  purposesOrdered.forEach((p, i) => {
    const gL = gLegend.append("g")
      .attr("transform", `translate(0, ${18 + i * itemHeight})`);

    gL.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", purposeColorScale(p));

    const text = gL.append("text")
      .attr("x", 14)
      .attr("y", 0)
      .attr("dy", "0.8em")
      .style("font-size", "10px")
      .text(p);

    wrapText(text, maxWidth || 100);
  });
}

// === Pair-level pie ===

function updatePairPie(donor, recipient) {
  if (!pairMap || !pairPieG) return;

  pairPieG.selectAll("*").remove();

  const key = donor + "||" + recipient;
  const pair = pairMap.get(key);
  if (!pair || !pair.purposes.length) {
    pairPieG.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 0)
      .text("No data for this donor–recipient pair (within top-5 purposes).");
    return;
  }

  const arcs = pie(pair.purposes);

  pairPieG.selectAll("path")
    .data(arcs)
    .enter()
    .append("path")
    .attr("d", arcPair)
    .attr("fill", d => purposeColorScale(d.data.purpose))
    .on("mouseover", (event, d) => {
      const pct = ((d.data.value / pair.total) * 100).toFixed(1);
      tooltip
        .style("opacity", 1)
        .html(
          `Donor: ${pair.donor}<br>` +
          `Recipient: ${pair.recipient}<br>` +
          `${d.data.purpose}<br>` +
          `Amount: $${formatAmount(d.data.value)} (${pct}%)`
        )
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });

  const labelArcs = arcs.filter(a => (a.data.value / pair.total) >= LABEL_THRESHOLD);

  pairPieG.selectAll("text.slice-label")
    .data(labelArcs)
    .enter()
    .append("text")
    .attr("class", "slice-label")
    .attr("transform", d => `translate(${arcPair.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "10px")
    .text(d => ((d.data.value / pair.total) * 100).toFixed(1) + "%");

  pairPieG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", - (Math.min(pairPieWidth, pairPieHeight) / 2 - 20))
    .style("font-size", "11px")
    .text(`${donor} → ${recipient}`);
}

// === Country-level pie ===

function updateCountryPie(country, mode) {
  if (!edgesByPurpose || !countryPieG) return;

  countryPieG.selectAll("*").remove();

  let rows;
  if (mode === "donor") {
    rows = edgesByPurpose.filter(d => d.donor === country);
  } else {
    rows = edgesByPurpose.filter(d => d.recipient === country);
  }
  if (!rows.length) {
    countryPieG.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 0)
      .text(`No ${mode === "donor" ? "outgoing" : "incoming"} flows (within top-5 purposes).`);
    return;
  }

  const agg = d3.rollups(
    rows,
    v => d3.sum(v, d => d.value),
    d => d.purpose
  ).map(([purpose, value]) => ({ purpose, value }));
  agg.sort((a, b) => d3.descending(a.value, b.value));

  const total = d3.sum(agg, d => d.value);
  const arcs = pie(agg);

  countryPieG.selectAll("path")
    .data(arcs)
    .enter()
    .append("path")
    .attr("d", arcCountry)
    .attr("fill", d => purposeColorScale(d.data.purpose))
    .on("mouseover", (event, d) => {
      const pct = ((d.data.value / total) * 100).toFixed(1);
      tooltip
        .style("opacity", 1)
        .html(
          `${country} as ${mode === "donor" ? "donor" : "recipient"}<br>` +
          `${d.data.purpose}<br>` +
          `Amount: $${formatAmount(d.data.value)} (${pct}%)`
        )
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });

  const labelArcs = arcs.filter(a => (a.data.value / total) >= LABEL_THRESHOLD);

  countryPieG.selectAll("text.slice-label")
    .data(labelArcs)
    .enter()
    .append("text")
    .attr("class", "slice-label")
    .attr("transform", d => `translate(${arcCountry.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "10px")
    .text(d => ((d.data.value / total) * 100).toFixed(1) + "%");

  countryPieG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", - (Math.min(countryPieWidth, countryPieHeight) / 2 - 20))
    .style("font-size", "11px")
    .text(`${country} – ${mode === "donor" ? "outgoing" : "incoming"}`);
}

function clearCountryPie() {
  if (!countryPieG) return;
  countryPieG.selectAll("*").remove();
}

// === 文本换行工具函数（用于图例） ===

function wrapText(textSelection, width) {
  textSelection.each(function() {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // em
    const x = text.attr("x") || 0;
    const y = text.attr("y") || 0;
    let dy = text.attr("dy");
    dy = dy ? parseFloat(dy) : 0;

    text.text(null);
    let tspan = text.append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", dy + "em");

    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", (++lineNumber * lineHeight + dy) + "em")
          .text(word);
      }
    }
  });
}
