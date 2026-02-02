/**
 * Aid Flow Visualization - Main Network View
 * 
 * Displays top 20 donors and top 10 recipients with connecting flow lines.
 * Line width and color encode the total commitment amount.
 * Click nodes/links to focus, click blank area to reset.
 */

// Configuration
const MAIN_WIDTH = 1100;
const MAIN_HEIGHT = 620;
const MAIN_MARGIN = { top: 40, right: 230, bottom: 40, left: 230 };

const INNER_WIDTH = MAIN_WIDTH - MAIN_MARGIN.left - MAIN_MARGIN.right;
const INNER_HEIGHT = MAIN_HEIGHT - MAIN_MARGIN.top - MAIN_MARGIN.bottom;

const DONOR_X = 0;
const RECIPIENT_X = INNER_WIDTH;

// Visual constants
const BASE_OPACITY = 0.75;
const HILITE_OPACITY = 0.98;
const NODE_RADIUS = 7;

// State
let selectedCountry = null;
let selectedRole = null;

// Create SVG and main group
const svg = d3.select("#chart")
  .append("svg")
  .attr("width", MAIN_WIDTH)
  .attr("height", MAIN_HEIGHT);

const mainGroup = svg.append("g")
  .attr("transform", `translate(${MAIN_MARGIN.left},${MAIN_MARGIN.top})`);

// Layers: links below, nodes above
const linkLayer = mainGroup.append("g").attr("class", "links-layer");
const nodeLayer = mainGroup.append("g").attr("class", "nodes-layer");

const tooltip = d3.select("#tooltip");

// Detail chart below (for showing country breakdowns)
const DETAIL_WIDTH = 800;
const DETAIL_HEIGHT = 400;
const detailSvg = d3.select("#detail")
  .append("svg")
  .attr("id", "detailSvg")
  .attr("width", DETAIL_WIDTH)
  .attr("height", DETAIL_HEIGHT);

// Format helpers
const formatAmount = d3.format(",.0f");
const formatShort = d3.format(".2s");

// Load and process data
d3.csv("aiddata-countries-only.csv").then(rawData => {
  // Clean and filter data
  const data = rawData
    .filter(d => d.donor && d.recipient && d.commitment_amount_usd_constant)
    .map(d => ({
      donor: d.donor,
      recipient: d.recipient,
      amount: +d.commitment_amount_usd_constant,
      year: +d.year
    }))
    .filter(d => d.amount > 0);

  // Step 1: Identify top 20 donors and top 10 recipients by total amount
  const donorTotalsFull = d3.rollups(
    data,
    v => d3.sum(v, d => d.amount),
    d => d.donor
  );
  donorTotalsFull.sort((a, b) => d3.descending(a[1], b[1]));
  const topDonorEntries = donorTotalsFull.slice(0, 20);
  const topDonors = new Set(topDonorEntries.map(d => d[0]));

  const recipientTotalsFull = d3.rollups(
    data,
    v => d3.sum(v, d => d.amount),
    d => d.recipient
  );
  recipientTotalsFull.sort((a, b) => d3.descending(a[1], b[1]));
  const topRecipientEntries = recipientTotalsFull.slice(0, 10);
  const topRecipients = new Set(topRecipientEntries.map(d => d[0]));

  // Filter to top donors and recipients only
  const filtered = data.filter(d => topDonors.has(d.donor) && topRecipients.has(d.recipient));

  // Preserve ordering by global totals
  const donorNodes = topDonorEntries.map(d => d[0]);
  const recipientNodes = topRecipientEntries.map(d => d[0]);

  // Step 2: Aggregate flows by donor-recipient pair
  const edgeRollup = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.amount),
    d => d.donor,
    d => d.recipient
  );

  const edges = edgeRollup.flatMap(([donor, recs]) =>
    recs.map(([recipient, value]) => ({ donor, recipient, value }))
  );

  // Step 3: Set up position scales
  const donorScale = d3.scaleBand()
    .domain(donorNodes)
    .range([0, INNER_HEIGHT])
    .padding(0.2);

  const recipientScale = d3.scaleBand()
    .domain(recipientNodes)
    .range([0, INNER_HEIGHT])
    .padding(0.2);

  // Step 4: Compute link width and color scales using quantiles
  const amounts = edges.map(d => d.value);
  const amountsSorted = amounts.slice().sort(d3.ascending);

  let lowQ = d3.quantile(amountsSorted, 0.1);
  let highQ = d3.quantile(amountsSorted, 0.9);
  if (lowQ === undefined || highQ === undefined || lowQ === highQ) {
    const ext = d3.extent(amounts);
    lowQ = ext[0] || 0;
    highQ = ext[1] || 1;
  }

  const widthScale = d3.scaleSqrt()
    .domain([lowQ, highQ])
    .range([1.5, 5]);

  const tMin = 0.35;
  const tMax = 0.95;

  function clampAmount(val) {
    return Math.max(lowQ, Math.min(highQ, val));
  }

  function getWidth(val) {
    const v = clampAmount(val);
    return widthScale(v);
  }

  function getColor(val) {
    const v = clampAmount(val);
    const denom = (highQ - lowQ) || 1;
    const norm = (v - lowQ) / denom;
    const t = tMin + (tMax - tMin) * norm;
    return d3.interpolateBlues(t);
  }

  // Step 5: Create node position maps
  const donorNodeInfo = new Map();
  donorNodes.forEach((name) => {
    const cy = donorScale(name) + donorScale.bandwidth() / 2;
    donorNodeInfo.set(name, { x: DONOR_X, y: cy, r: NODE_RADIUS });
  });

  const recipientNodeInfo = new Map();
  recipientNodes.forEach((name) => {
    const cy = recipientScale(name) + recipientScale.bandwidth() / 2;
    recipientNodeInfo.set(name, { x: RECIPIENT_X, y: cy, r: NODE_RADIUS });
  });

  // Node data objects with role
  const donorData = donorNodes.map(name => ({ name, role: "donor" }));
  const recipientData = recipientNodes.map(name => ({ name, role: "recipient" }));

  // Step 6: Draw links (bottom layer)
  const links = linkLayer.selectAll(".link")
    .data(edges)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("x1", d => {
      const info = donorNodeInfo.get(d.donor);
      return info.x + info.r + 4;
    })
    .attr("y1", d => donorNodeInfo.get(d.donor).y)
    .attr("x2", d => {
      const info = recipientNodeInfo.get(d.recipient);
      return info.x - info.r - 4;
    })
    .attr("y2", d => recipientNodeInfo.get(d.recipient).y)
    .attr("stroke", d => getColor(d.value))
    .attr("stroke-width", d => getWidth(d.value))
    .attr("stroke-opacity", BASE_OPACITY)
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Donor: ${d.donor}<br>` +
          `Recipient: ${d.recipient}<br>` +
          `Amount: $${formatAmount(d.value)}`
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
    })
    .on("click", (event, d) => {
      const ok = selectCountry(d.donor, "donor");
      if (ok) {
        showDetail(d.donor, "donor");
      }
    });

  // Step 7: Draw donor nodes on the left
  const donorGroup = nodeLayer.selectAll(".donor-node")
    .data(donorData)
    .enter()
    .append("g")
    .attr("class", "node-group donor-node")
    .attr("transform", d => {
      const info = donorNodeInfo.get(d.name);
      return `translate(${info.x}, ${info.y})`;
    });

  donorGroup.append("circle")
    .attr("class", "node-circle")
    .attr("r", NODE_RADIUS)
    .on("click", (event, d) => {
      const ok = selectCountry(d.name, "donor");
      if (ok) {
        showDetail(d.name, "donor");
      }
    });

  donorGroup.append("text")
    .attr("class", "node-label")
    .attr("x", -110)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(d => `#${donorNodes.indexOf(d.name) + 1} ${d.name}`)
    .on("click", (event, d) => {
      const ok = selectCountry(d.name, "donor");
      if (ok) {
        showDetail(d.name, "donor");
      }
    });

  // Step 8: Draw recipient nodes on the right
  const recipientGroup = nodeLayer.selectAll(".recipient-node")
    .data(recipientData)
    .enter()
    .append("g")
    .attr("class", "node-group recipient-node")
    .attr("transform", d => {
      const info = recipientNodeInfo.get(d.name);
      return `translate(${info.x}, ${info.y})`;
    });

  recipientGroup.append("circle")
    .attr("class", "node-circle")
    .attr("r", NODE_RADIUS)
    .on("click", (event, d) => {
      const ok = selectCountry(d.name, "recipient");
      if (ok) {
        showDetail(d.name, "recipient");
      }
    });

  recipientGroup.append("text")
    .attr("class", "node-label")
    .attr("x", 10)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(d => `#${recipientNodes.indexOf(d.name) + 1} ${d.name}`)
    .on("click", (event, d) => {
      const ok = selectCountry(d.name, "recipient");
      if (ok) {
        showDetail(d.name, "recipient");
      }
    });

  const nodeGroups = nodeLayer.selectAll(".node-group");

  // Step 9: Draw legend for link sizes
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${MAIN_WIDTH - MAIN_MARGIN.right + 80}, ${MAIN_MARGIN.top})`);

  legend.append("text")
    .attr("font-weight", 600)
    .attr("y", 0)
    .text("Edge: Total Amount");

  const legendVals = [lowQ, (lowQ + highQ) / 2, highQ];
  const legendLabels = ["Small", "Medium", "Large"];

  legendVals.forEach((val, i) => {
    const y = 20 + i * 22;
    legend.append("line")
      .attr("class", "legend-line")
      .attr("x1", 0)
      .attr("x2", 40)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", getColor(val))
      .attr("stroke-width", getWidth(val))
      .attr("stroke-opacity", BASE_OPACITY);

    legend.append("text")
      .attr("x", 48)
      .attr("y", y + 4)
      .text(`${legendLabels[i]} ($${formatShort(val)})`);
  });

  // === Selection and highlighting logic ===

  /**
   * Select/deselect a country.
   * @param {string} name - Country name
   * @param {string} role - "donor" or "recipient"
   * @returns {boolean} - true if selected, false if deselected
   */
  function selectCountry(name, role) {
    if (selectedCountry && selectedCountry === name && selectedRole === role) {
      // Deselect
      selectedCountry = null;
      selectedRole = null;
      updateSelection();
      detailSvg.selectAll("*").remove();
      d3.select("#detailTitle").text("Click a donor or recipient to see its detailed flows.");
      return false;
    } else {
      // Select
      selectedCountry = name;
      selectedRole = role;
      updateSelection();
      return true;
    }
  }

  /**
   * Update visibility of links and nodes based on current selection.
   */
  function updateSelection() {
    if (!selectedCountry) {
      // Overview mode: show all
      links
        .style("display", null)
        .style("stroke-opacity", BASE_OPACITY);

      nodeGroups
        .style("display", null);

      nodeGroups.selectAll(".node-label").classed("highlight", false);
      nodeGroups.selectAll(".node-circle").classed("highlight", false);
      return;
    }

    const { role } = { role: selectedRole };
    const name = selectedCountry;

    // Calculate neighbors (nodes on the other side that connect to this one)
    const neighbors = new Set();
    edges.forEach(e => {
      if (role === "donor" && e.donor === name) {
        neighbors.add(e.recipient);
      } else if (role === "recipient" && e.recipient === name) {
        neighbors.add(e.donor);
      }
    });

    // Show only links involving this country
    links
      .style("display", d => {
        if (role === "donor") {
          return d.donor === name ? null : "none";
        } else {
          return d.recipient === name ? null : "none";
        }
      })
      .style("stroke-opacity", HILITE_OPACITY);

    // Highlight selected node and its neighbors
    nodeGroups
      .style("display", null);

    nodeGroups.selectAll(".node-label")
      .classed("highlight", d => {
        if (d.name === name && d.role === role) return true;
        if (d.role !== role && neighbors.has(d.name)) return true;
        return false;
      });

    nodeGroups.selectAll(".node-circle")
      .classed("highlight", d => {
        if (d.name === name && d.role === role) return true;
        if (d.role !== role && neighbors.has(d.name)) return true;
        return false;
      });
  }

  // Initialize view
  updateSelection();

  /**
   * Display detailed breakdown of a country's flows in the detail chart.
   * @param {string} country - Country name
   * @param {string} role - "donor" or "recipient"
   */
  function showDetail(country, role) {
    let rows, title;

    if (role === "donor") {
      rows = edges
        .filter(d => d.donor === country)
        .sort((a, b) => d3.descending(a.value, b.value));
      title = `Donor: ${country} → Recipients (by Total Commitment Amount)`;
    } else {
      rows = edges
        .filter(d => d.recipient === country)
        .sort((a, b) => d3.descending(a.value, b.value));
      title = `Recipient: ${country} ← Donors (by Total Commitment Amount)`;
    }

    d3.select("#detailTitle").text(
      rows.length
        ? title
        : `${country} has no flows in the filtered top-20/top-10 subset.`
    );

    detailSvg.selectAll("*").remove();
    if (!rows.length) return;

    // Draw bar chart
    const marginD = { top: 30, right: 30, bottom: 50, left: 220 };
    const widthD = DETAIL_WIDTH - marginD.left - marginD.right;
    const heightD = DETAIL_HEIGHT - marginD.top - marginD.bottom;

    const gD = detailSvg.append("g")
      .attr("transform", `translate(${marginD.left},${marginD.top})`);

    const names = rows.map(d => role === "donor" ? d.recipient : d.donor);
    const yD = d3.scaleBand()
      .domain(names)
      .range([0, heightD])
      .padding(0.2);

    const xD = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d.value)])
      .nice()
      .range([0, widthD]);

    // Draw axes
    gD.append("g").call(d3.axisLeft(yD));

    gD.append("g")
      .attr("transform", `translate(0,${heightD})`)
      .call(d3.axisBottom(xD).ticks(5).tickFormat(d => "$" + formatShort(d)))
      .append("text")
      .attr("x", widthD / 2)
      .attr("y", 40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .text("Total Commitment Amount (USD, Constant)");

    // Draw bars
    gD.selectAll("rect")
      .data(rows)
      .enter()
      .append("rect")
      .attr("y", d => yD(role === "donor" ? d.recipient : d.donor))
      .attr("height", yD.bandwidth())
      .attr("x", 0)
      .attr("width", d => xD(d.value))
      .attr("fill", "#4C78A8")
      .on("mouseover", (event, d) => {
        const other = role === "donor" ? d.recipient : d.donor;
        tooltip
          .style("opacity", 1)
          .html(
            `${country} ↔ ${other}<br>` +
            `Amount: $${formatAmount(d.value)}`
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
  }
}).catch(err => {
  console.error("Error loading CSV:", err);
  alert("Error loading aiddata-countries-only.csv. Ensure file is in same directory and served over HTTP.");
});
