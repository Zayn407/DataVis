// vis1.js

const mainWidth  = 1100;
const mainHeight = 620;
const mainMargin = { top: 40, right: 230, bottom: 40, left: 230 };

const innerWidth  = mainWidth  - mainMargin.left - mainMargin.right;
const innerHeight = mainHeight - mainMargin.top  - mainMargin.bottom;

const donorX     = 0;
const recipientX = innerWidth;

const svg = d3.select("#chart")
  .append("svg")
  .attr("width", mainWidth)
  .attr("height", mainHeight);

const g = svg.append("g")
  .attr("transform", `translate(${mainMargin.left},${mainMargin.top})`);

// 线在底层，节点在上层
const linkLayer = g.append("g").attr("class", "links-layer");
const nodeLayer = g.append("g").attr("class", "nodes-layer");

const tooltip = d3.select("#tooltip");

const detailWidth  = 800;
const detailHeight = 400;

const detailSvg = d3.select("#detail")
  .append("svg")
  .attr("id", "detailSvg")
  .attr("width", detailWidth)
  .attr("height", detailHeight);

const formatAmount = d3.format(",.0f");
const formatShort  = d3.format(".2s");

const BASE_OPACITY = 0.75; // 默认所有边的透明度
const HILITE_OPACITY = 0.98;

d3.csv("aiddata-countries-only.csv").then(raw => {
  // 当前选中的国家（点击后锁定）
  let selectedCountry = null;

  const data = raw
    .filter(d => d.donor && d.recipient && d.commitment_amount_usd_constant)
    .map(d => ({
      donor: d.donor,
      recipient: d.recipient,
      amount: +d.commitment_amount_usd_constant,
      year: +d.year
    }))
    .filter(d => d.amount > 0);

  // 1. donor & recipient 全时期总额，用于排名（节点大小统一，就不再 encode size）
  let donorTotalsFull = d3.rollups(
    data,
    v => d3.sum(v, d => d.amount),
    d => d.donor
  );
  donorTotalsFull.sort((a, b) => d3.descending(a[1], b[1]));
  const topDonorEntries = donorTotalsFull.slice(0, 20);
  const topDonors = new Set(topDonorEntries.map(d => d[0]));

  let recipientTotalsFull = d3.rollups(
    data,
    v => d3.sum(v, d => d.amount),
    d => d.recipient
  );
  recipientTotalsFull.sort((a, b) => d3.descending(a[1], b[1]));
  const topRecipientEntries = recipientTotalsFull.slice(0, 10);
  const topRecipients = new Set(topRecipientEntries.map(d => d[0]));

  // 2. 只保留 top20 donor → top10 recipient 的记录用于画边
  const filtered = data.filter(d => topDonors.has(d.donor) && topRecipients.has(d.recipient));

  // 3. 顺序 = 全局总额排名
  const donorNodes     = topDonorEntries.map(d => d[0]);
  const recipientNodes = topRecipientEntries.map(d => d[0]);

  // 4. 边聚合
  const edgeRollup = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.amount),
    d => d.donor,
    d => d.recipient
  );

  const edges = edgeRollup.flatMap(([donor, recs]) =>
    recs.map(([recipient, value]) => ({ donor, recipient, value }))
  );

  // 5. 邻居 map：用于“只留选中节点和其邻居”
  const neighborMap = new Map();
  edges.forEach(e => {
    if (!neighborMap.has(e.donor)) neighborMap.set(e.donor, new Set());
    if (!neighborMap.has(e.recipient)) neighborMap.set(e.recipient, new Set());
    neighborMap.get(e.donor).add(e.recipient);
    neighborMap.get(e.recipient).add(e.donor);
  });

  // 6. 位置尺度
  const donorScale = d3.scaleBand()
    .domain(donorNodes)
    .range([0, innerHeight])
    .padding(0.2);

  const recipientScale = d3.scaleBand()
    .domain(recipientNodes)
    .range([0, innerHeight])
    .padding(0.2);

  // 7. 线宽和颜色 —— 使用分位数 + clamp，small 颜色也不太淡
  const amounts = edges.map(d => d.value);
  const amountsSorted = amounts.slice().sort(d3.ascending);

  let lowQ  = d3.quantile(amountsSorted, 0.1);
  let highQ = d3.quantile(amountsSorted, 0.9);
  if (lowQ === undefined || highQ === undefined || lowQ === highQ) {
    const ext = d3.extent(amounts);
    lowQ  = ext[0] || 0;
    highQ = ext[1] || 1;
  }

  const widthScale = d3.scaleSqrt()
    .domain([lowQ, highQ])
    .range([1.5, 5]); // 最细 1.5px, 最粗 5px

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
    const norm = (v - lowQ) / denom;       // 0~1
    const t = tMin + (tMax - tMin) * norm; // 0.35~0.95
    return d3.interpolateBlues(t);
  }

  // 8. 统一节点半径（不 encode 金额）
  const NODE_RADIUS = 7;

  const donorNodeInfo = new Map();
  donorNodes.forEach((name) => {
    const cy = donorScale(name) + donorScale.bandwidth() / 2;
    donorNodeInfo.set(name, { x: donorX, y: cy, r: NODE_RADIUS });
  });

  const recipientNodeInfo = new Map();
  recipientNodes.forEach((name) => {
    const cy = recipientScale(name) + recipientScale.bandwidth() / 2;
    recipientNodeInfo.set(name, { x: recipientX, y: cy, r: NODE_RADIUS });
  });

  // 9. 画边（底层）
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
      const selected = selectCountry(d.donor);
      if (selected) {
        showDetail(d.donor, "donor");
      }
    });

  // 10. 画节点（上层）：donor 左侧
  const donorGroup = nodeLayer.selectAll(".donor-node")
    .data(donorNodes)
    .enter()
    .append("g")
    .attr("class", "node-group donor-node")
    .attr("transform", d => {
      const info = donorNodeInfo.get(d);
      return `translate(${info.x}, ${info.y})`;
    });

  donorGroup.append("circle")
    .attr("class", "node-circle")
    .attr("r", NODE_RADIUS)
    .on("click", (event, d) => {
      const selected = selectCountry(d);
      if (selected) {
        showDetail(d, "donor");
      }
    });

  donorGroup.append("text")
    .attr("class", "node-label")
    .attr("x", -10)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .text(d => `#${donorNodes.indexOf(d) + 1} ${d}`)
    .on("click", (event, d) => {
      const selected = selectCountry(d);
      if (selected) {
        showDetail(d, "donor");
      }
    });

  // recipient 右侧
  const recipientGroup = nodeLayer.selectAll(".recipient-node")
    .data(recipientNodes)
    .enter()
    .append("g")
    .attr("class", "node-group recipient-node")
    .attr("transform", d => {
      const info = recipientNodeInfo.get(d);
      return `translate(${info.x}, ${info.y})`;
    });

  recipientGroup.append("circle")
    .attr("class", "node-circle")
    .attr("r", NODE_RADIUS)
    .on("click", (event, d) => {
      const selected = selectCountry(d);
      if (selected) {
        showDetail(d, "recipient");
      }
    });

  recipientGroup.append("text")
    .attr("class", "node-label")
    .attr("x", 10)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(d => `#${recipientNodes.indexOf(d) + 1} ${d}`)
    .on("click", (event, d) => {
      const selected = selectCountry(d);
      if (selected) {
        showDetail(d, "recipient");
      }
    });

  // 11. 边的 legend（small/medium/large）
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${mainWidth - mainMargin.right + 40}, ${mainMargin.top})`);

  legend.append("text")
    .attr("font-weight", 600)
    .attr("y", 0)
    .text("Edge: total amount");

  const legendVals   = [lowQ, (lowQ + highQ) / 2, highQ];
  const legendLabels = ["small", "medium", "large"];

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

  // === 选中 / 高亮逻辑 ===

  const nodeGroups = nodeLayer.selectAll(".node-group");

  // 点击国家：选中 / 取消选中；返回 true 表示选中，false 表示取消
  function selectCountry(country) {
    if (selectedCountry === country) {
      // 取消选中，恢复 overview
      selectedCountry = null;
      updateSelection();
      detailSvg.selectAll("*").remove();
      d3.select("#detailTitle").text("Click a donor or recipient to see its detailed flows.");
      return false;
    } else {
      selectedCountry = country;
      updateSelection();
      return true;
    }
  }

  // 根据 selectedCountry 更新：隐藏/显示边和节点
  function updateSelection() {
    if (!selectedCountry) {
      // 没选中任何国家：显示全部
      links
        .style("display", null)
        .style("stroke-opacity", BASE_OPACITY);

      nodeGroups
        .style("display", null);

      svg.selectAll(".node-label").classed("highlight", false);
      svg.selectAll(".node-circle").classed("highlight", false);
      return;
    }

    const neighbors = neighborMap.get(selectedCountry) || new Set();

    // 只显示与 selectedCountry 相连的边
    links
      .style("display", d => (d.donor === selectedCountry || d.recipient === selectedCountry) ? null : "none")
      .style("stroke-opacity", HILITE_OPACITY);

    // 只显示 selectedCountry 以及和它相连的国家节点
    nodeGroups
      .style("display", d =>
        d === selectedCountry || neighbors.has(d) ? null : "none"
      );

    // 高亮 selectedCountry + 邻居的 label/circle
    svg.selectAll(".node-label")
      .classed("highlight", d => d === selectedCountry || neighbors.has(d));

    svg.selectAll(".node-circle")
      .classed("highlight", d => d === selectedCountry || neighbors.has(d));
  }

  // 初始：overview 状态
  updateSelection();

  // === 下方 detail 条形图 ===

  function showDetail(country, role) {
    let rows, title;

    if (role === "donor") {
      rows = edges
        .filter(d => d.donor === country)
        .sort((a, b) => d3.descending(a.value, b.value));
      title = `Donor: ${country} → recipients (by total commitment amount)`;
    } else {
      rows = edges
        .filter(d => d.recipient === country)
        .sort((a, b) => d3.descending(a.value, b.value));
      title = `Recipient: ${country} ← donors (by total commitment amount)`;
    }

    d3.select("#detailTitle").text(
      rows.length
        ? title
        : `${country} has no flows in the filtered top-20/top-10 subset.`
    );

    detailSvg.selectAll("*").remove();
    if (!rows.length) return;

    const marginD = { top: 30, right: 30, bottom: 50, left: 220 };
    const widthD  = detailWidth  - marginD.left - marginD.right;
    const heightD = detailHeight - marginD.top  - marginD.bottom;

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

    gD.append("g").call(d3.axisLeft(yD));

    gD.append("g")
      .attr("transform", `translate(0,${heightD})`)
      .call(d3.axisBottom(xD).ticks(5).tickFormat(d => "$" + formatShort(d)))
      .append("text")
      .attr("x", widthD / 2)
      .attr("y", 40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .text("Total commitment amount (USD, constant)");

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
  alert("Error loading aiddata-countries-only.csv. Make sure the file is in the same folder and served over HTTP (not file://).");
});
