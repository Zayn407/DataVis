/**
 * Aid Purpose Breakdown - Purpose-Centric Flow Analysis
 * 
 * Visualizes aid flows broken down by purpose (Top 5 categories).
 * Links use gradient colors to show multiple purposes.
 * Two pie charts show: (1) pair-level breakdown, (2) country-level by purpose.
 */

// Configuration
const MAIN_WIDTH = 1100;
const MAIN_HEIGHT = 620;
const MAIN_MARGIN = { top: 40, right: 310, bottom: 40, left: 230 };

const INNER_WIDTH = MAIN_WIDTH - MAIN_MARGIN.left - MAIN_MARGIN.right;
const INNER_HEIGHT = MAIN_HEIGHT - MAIN_MARGIN.top - MAIN_MARGIN.bottom;

const DONOR_X = 0;
const RECIPIENT_X = INNER_WIDTH;

const PIE_WIDTH = 400;
const PIE_HEIGHT = 300;

const BASE_OPACITY = 0.70;
const HILITE_OPACITY = 0.98;
const NODE_RADIUS = 7;
const LABEL_THRESHOLD = 0.05;

// Create SVG
const svg = d3.select("#mainChart")
  .append("svg")
  .attr("width", MAIN_WIDTH)
  .attr("height", MAIN_HEIGHT);

const mainGroup = svg.append("g")
  .attr("transform", `translate(${MAIN_MARGIN.left},${MAIN_MARGIN.top})`);

// Layers
const linkLayer = mainGroup.append("g").attr("class", "links-layer");
const nodeLayer = mainGroup.append("g").attr("class", "nodes-layer");
const defs = svg.append("defs");

const tooltip = d3.select("#tooltip");

// Pie charts
const pairPieSvg = d3.select("#pairPie")
  .append("svg")
  .attr("width", PIE_WIDTH)
  .attr("height", PIE_HEIGHT);

const countryPieSvg = d3.select("#countryPie")
  .append("svg")
  .attr("width", PIE_WIDTH)
  .attr("height", PIE_HEIGHT);

const pairPieG = pairPieSvg.append("g")
  .attr("transform", `translate(${PIE_WIDTH / 2 - 80}, ${PIE_HEIGHT / 2})`);

const countryPieG = countryPieSvg.append("g")
  .attr("transform", `translate(${PIE_WIDTH / 2 - 80}, ${PIE_HEIGHT / 2})`);

const pairLegendG = pairPieSvg.append("g")
  .attr("class", "pie-legend pair-legend")
  .attr("transform", `translate(${PIE_WIDTH - 120}, 40)`);

const countryLegendG = countryPieSvg.append("g")
  .attr("class", "pie-legend country-legend")
  .attr("transform", `translate(${PIE_WIDTH - 120}, 40)`);

// Arc generators
const pie = d3.pie()
  .value(d => d.value)
  .sort(null);

const arcPair = d3.arc()
  .innerRadius(0)
  .outerRadius(Math.min(PIE_WIDTH, PIE_HEIGHT) / 2 - 40);

const arcCountry = d3.arc()
  .innerRadius(0)
  .outerRadius(Math.min(PIE_WIDTH, PIE_HEIGHT) / 2 - 40);

// Format helpers
const formatAmount = d3.format(",.0f");
const formatShort = d3.format(".2s");

// State
let donorsOrdered = [];
let recipientsOrdered = [];
let purposesOrdered = [];
let pairMap = new Map();
let edgesByPurpose = [];
let links = null;
let nodeGroups = null;
let purposeColorScale = null;
let selected = null;

// DOM selectors
const pairDonorSelect = document.getElementById("pairDonorSelect");
const pairRecipientSelect = document.getElementById("pairRecipientSelect");
const countrySelect = document.getElementById("countrySelect");
const countryModeInputs = document.getElementsByName("countryMode");

/**
 * Load and process CSV data.
 */
d3.csv("aiddata-countries-only.csv").then(raw => {
  // Clean data: filter valid records
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

  // Identify top 20 donors, top 10 recipients
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

  donorsOrdered = donorTotals.slice(0, 20).map(d => d[0]);
  recipientsOrdered = recipientTotals.slice(0, 10).map(d => d[0]);

  const topDonorSet = new Set(donorsOrdered);
  const topRecipientSet = new Set(recipientsOrdered);

  let filtered = data.filter(d =>
    topDonorSet.has(d.donor) && topRecipientSet.has(d.recipient)
  );

  // Identify top 5 purposes
  let purposeTotals = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.amount),
    d => d.purpose
  ).sort((a, b) => d3.descending(a[1], b[1]));

  purposesOrdered = purposeTotals.slice(0, 5).map(d => d[0]);
  const topPurposeSet = new Set(purposesOrdered);

  filtered = filtered.filter(d => topPurposeSet.has(d.purpose));

  // Recompute totals on filtered data
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

  donorsOrdered = donorTotals.map(d => d[0]);
  recipientsOrdered = recipientTotals.map(d => d[0]);

  // Aggregate by donor-recipient-purpose
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

  // Build pair map: aggregate totals and per-purpose breakdown
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

  // Merge purposes within each pair
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

  // Set up scales
  const totalExtent = d3.extent(pairsArray, d => d.total);
  const minT = totalExtent[0] || 0;
  const maxT = totalExtent[1] || 1;

  const widthScale = d3.scaleSqrt()
    .domain([minT, maxT])
    .range([1.5, 6]);

  const palette = [
    "#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854"
  ];

  purposeColorScale = d3.scaleOrdinal()
    .domain(purposesOrdered)
    .range(palette.slice(0, purposesOrdered.length));

  // Node position scales
  const donorScale = d3.scaleBand()
    .domain(donorsOrdered)
    .range([0, INNER_HEIGHT])
    .padding(0.2);

  const recipientScale = d3.scaleBand()
    .domain(recipientsOrdered)
    .range([0, INNER_HEIGHT])
    .padding(0.2);

  const donorNodeInfo = new Map();
  donorsOrdered.forEach(name => {
    const cy = donorScale(name) + donorScale.bandwidth() / 2;
    donorNodeInfo.set(name, { x: DONOR_X, y: cy, r: NODE_RADIUS });
  });

  const recipientNodeInfo = new Map();
  recipientsOrdered.forEach(name => {
    const cy = recipientScale(name) + recipientScale.bandwidth() / 2;
    recipientNodeInfo.set(name, { x: RECIPIENT_X, y: cy, r: NODE_RADIUS });
  });

  const donorData = donorsOrdered.map(name => ({ name, role: "donor" }));
  const recipientData = recipientsOrdered.map(name => ({ name, role: "recipient" }));

  // Create gradients for each pair edge
  pairsArray.forEach(pair => {
    const infoDonor = donorNodeInfo.get(pair.donor);
    const infoRec = recipientNodeInfo.get(pair.recipient);
    if (!infoDonor || !infoRec) return;

    const x1 = infoDonor.x + infoDonor.r + 4;
    const y1 = infoDonor.y;
    const x2 = infoRec.x - infoRec.r - 4;
    const y2 = infoRec.y;

    const gradId = `grad-${pair.donor.replace(/\s+/g,"_")}-${pair.recipient.replace(/\s+/g,"_")}`;
    const lg = defs.append("linearGradient")
      .attr("id", gradId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", MAIN_MARGIN.left + x1)
      .attr("y1", MAIN_MARGIN.top + y1)
      .attr("x2", MAIN_MARGIN.left + x2)
      .attr("y2", MAIN_MARGIN.top + y2);

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

  // Draw links with gradient colors
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
      pairDonorSelect.value = d.donor;
      pairRecipientSelect.value = d.recipient;
      updatePairPie(d.donor, d.recipient);
    });

  // Draw donor nodes on the left
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

  // Draw recipient nodes on the right
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

  // Draw legend for top 5 purposes
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${MAIN_WIDTH - MAIN_MARGIN.right + 80}, ${MAIN_MARGIN.top})`);

  legend.append("text")
    .text("Top 5 Purposes")
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

  // Initialize pie legends
  drawPieLegend(pairLegendG, 100);
  drawPieLegend(countryLegendG, 100);

  // Populate dropdowns
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

  const allCountries = new Set();
  donorsOrdered.forEach(d => allCountries.add(d));
  recipientsOrdered.forEach(r => allCountries.add(r));
  Array.from(allCountries).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });

  // Initialize view
  updateSelection();

  // Set up event listeners
  pairDonorSelect.addEventListener("change", () => {
    const donor = pairDonorSelect.value;
    const recipient = pairRecipientSelect.value;
    if (donor && recipient) {
      updatePairPie(donor, recipient);
    }
  });

  pairRecipientSelect.addEventListener("change", () => {
    const donor = pairDonorSelect.value;
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
  alert("Error loading aiddata-countries-only.csv. Ensure file is in same directory and served over HTTP.");
});

// === Selection and highlighting ===

/**
 * Toggle selection of a country node.
 */
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

/**
 * Update link and node visibility based on selection.
 */
function updateSelection() {
  if (!links) return;

  if (!selected) {
    links
      .style("display", null)
      .style("stroke-opacity", BASE_OPACITY);

    if (nodeGroups) {
      nodeGroups.style("display", null);
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
    nodeGroups.style("display", null);

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

// === Pie chart legend ===

/**
 * Draw a legend for pie charts showing purpose categories.
 */
function drawPieLegend(gLegend, maxWidth) {
  if (!gLegend || !purposesOrdered || !purposeColorScale) return;

  gLegend.selectAll("*").remove();

  gLegend.append("text")
    .attr("font-weight", "600")
    .attr("y", 0)
    .style("font-size", "11px")
    .text("Purposes");

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

// === Pie charts: pair-level and country-level ===

/**
 * Display purpose breakdown for a specific donor-recipient pair.
 */
function updatePairPie(donor, recipient) {
  if (!pairMap || !pairPieG) return;

  pairPieG.selectAll("*").remove();

  const key = donor + "||" + recipient;
  const pair = pairMap.get(key);
  if (!pair || !pair.purposes.length) {
    pairPieG.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 0)
      .text("No data for this pair.");
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
    .attr("dy", - (Math.min(PIE_WIDTH, PIE_HEIGHT) / 2 - 20))
    .style("font-size", "11px")
    .text(`${donor} → ${recipient}`);
}

/**
 * Display purpose breakdown for a country (donor or recipient mode).
 */
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
      .text(`No ${mode === "donor" ? "outgoing" : "incoming"} flows.`);
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
          `${country} as ${mode === "donor" ? "Donor" : "Recipient"}<br>` +
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
    .attr("dy", - (Math.min(PIE_WIDTH, PIE_HEIGHT) / 2 - 20))
    .style("font-size", "11px")
    .text(`${country} – ${mode === "donor" ? "Outgoing" : "Incoming"}`);
}

/**
 * Clear the country pie chart.
 */
function clearCountryPie() {
  if (!countryPieG) return;
  countryPieG.selectAll("*").remove();
}

// === Text wrapping utility ===

/**
 * Wrap text in SVG to fit within a specified width.
 */
function wrapText(textSelection, width) {
  textSelection.each(function() {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
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
