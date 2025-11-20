// vis3.js – Visualization 3: Time-varying Aid Flows

const mainWidth  = 1100;
const mainHeight = 580;
const mainMargin = { top: 40, right: 230, bottom: 40, left: 230 };
const innerWidth  = mainWidth - mainMargin.left - mainMargin.right;
const innerHeight = mainHeight - mainMargin.top - mainMargin.bottom;

const donorX     = 0;
const recipientX = innerWidth;

// 下方折线图尺寸
const detailWidth  = 900;
const detailHeight = 250;
const detailMargin = { top: 20, right: 30, bottom: 30, left: 60 };
const detailInnerW = detailWidth - detailMargin.left - detailMargin.right;
const detailInnerH = detailHeight - detailMargin.top - detailMargin.bottom;

// 主图 SVG
const svg = d3.select("body") // 假设直接append到body或特定div
  .append("div")
  .attr("id", "mainChart")
  .append("svg")
  .attr("width", mainWidth)
  .attr("height", mainHeight);

const g = svg.append("g")
  .attr("transform", `translate(${mainMargin.left},${mainMargin.top})`);

const linkLayer = g.append("g").attr("class", "links-layer");
const nodeLayer = g.append("g").attr("class", "nodes-layer");

// 详情图 SVG
const detailSvg = d3.select("body")
  .append("div")
  .attr("id", "detailChart")
  .append("svg")
  .attr("width", detailWidth)
  .attr("height", detailHeight);

const detailG = detailSvg.append("g")
  .attr("transform", `translate(${detailMargin.left},${detailMargin.top})`);

// 工具与比例尺
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

const formatAmount = d3.format(",.0f");

// 全局状态
let allData = [];
let donorsOrdered = [];
let recipientsOrdered = [];
let years = [];
let currentYear = 0;
let playInterval = null;
let isPlaying = false;

let selectedPair = null; // {donor, recipient} or null
let selectedNode = null; // {name, role} or null

// 比例尺
let yScaleDonor, yScaleRecipient, widthScale;
let detailXScale, detailYScale;

d3.csv("aiddata-countries-only.csv").then(raw => {
  // 1. 数据清洗与解析
  const data = raw
    .filter(d => d.donor && d.recipient && d.commitment_amount_usd_constant && d.year)
    .map(d => ({
      donor: d.donor,
      recipient: d.recipient,
      amount: +d.commitment_amount_usd_constant,
      year: +d.year
    }));

  // 2. 确定 Top 20 Donors 和 Top 10 Recipients (基于历史总额)
  const donorTotals = d3.rollups(data, v => d3.sum(v, d => d.amount), d => d.donor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(d => d[0]);
  
  const recipientTotals = d3.rollups(data, v => d3.sum(v, d => d.amount), d => d.recipient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(d => d[0]);

  donorsOrdered = donorTotals;
  recipientsOrdered = recipientTotals;

  // 3. 过滤数据，只保留 Top 国家之间的交易
  const topDonorSet = new Set(donorsOrdered);
  const topRecipientSet = new Set(recipientsOrdered);
  
  const filtered = data.filter(d => topDonorSet.has(d.donor) && topRecipientSet.has(d.recipient));
  allData = filtered;

  // 4. 提取年份范围
  const yearExtent = d3.extent(filtered, d => d.year);
  const minYear = yearExtent[0];
  const maxYear = yearExtent[1];
  // 生成完整年份数组
  years = d3.range(minYear, maxYear + 1);
  currentYear = minYear;

  // 5. 初始化比例尺
  yScaleDonor = d3.scaleBand()
    .domain(donorsOrdered)
    .range([0, innerHeight])
    .padding(0.4); // 间距稍微大点方便看线

  yScaleRecipient = d3.scaleBand()
    .domain(recipientsOrdered)
    .range([0, innerHeight])
    .padding(0.4);

  // 线宽比例尺：需要基于所有年份中最大的单笔交易来定，防止爆炸
  const maxAnnualAmount = d3.max(filtered, d => d.amount);
  widthScale = d3.scaleSqrt()
    .domain([0, maxAnnualAmount])
    .range([0, 15]); // 0金额就是0宽度

  // 详情图比例尺
  detailXScale = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([0, detailInnerW]);
  
  detailYScale = d3.scaleLinear()
    .range([detailInnerH, 0]);

  // 6. 绘制静态节点 (节点位置不动)
  drawNodes();

  // 7. 初始化控件
  setupControls(minYear, maxYear);

  // 8. 渲染初始年份
  updateYear(minYear);
  updateDetailChart(); // 默认显示总体趋势

});

function drawNodes() {
  // Donors 左侧
  const donorG = nodeLayer.selectAll(".donor")
    .data(donorsOrdered)
    .enter().append("g")
    .attr("class", "donor")
    .attr("transform", d => `translate(${donorX}, ${yScaleDonor(d) + yScaleDonor.bandwidth()/2})`);

  donorG.append("circle")
    .attr("r", 6)
    .attr("fill", "#4C78A8")
    .style("cursor", "pointer")
    .on("click", (e, d) => selectNode(d, "donor"));

  donorG.append("text")
    .text(d => d)
    .attr("x", -10)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .style("cursor", "pointer")
    .on("click", (e, d) => selectNode(d, "donor"));

  // Recipients 右侧
  const recipientG = nodeLayer.selectAll(".recipient")
    .data(recipientsOrdered)
    .enter().append("g")
    .attr("class", "recipient")
    .attr("transform", d => `translate(${recipientX}, ${yScaleRecipient(d) + yScaleRecipient.bandwidth()/2})`);

  recipientG.append("circle")
    .attr("r", 6)
    .attr("fill", "#E15759")
    .style("cursor", "pointer")
    .on("click", (e, d) => selectNode(d, "recipient"));

  recipientG.append("text")
    .text(d => d)
    .attr("x", 10)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .style("font-size", "11px")
    .style("cursor", "pointer")
    .on("click", (e, d) => selectNode(d, "recipient"));
}

function updateYear(year) {
  currentYear = year;
  d3.select("#yearLabel").text(year);
  d3.select("#yearSlider").property("value", year);

  // 聚合该年的数据
  const yearData = allData.filter(d => d.year === year);
  
  // 此时我们需要确保所有可能的 donor-recipient 对都有数据（没有就是0），以便做平滑动画
  // 简单的做法是直接用 yearData 做 data join，key 是 donor+recipient
  const linksData = d3.rollups(yearData, v => d3.sum(v, d => d.amount), d => d.donor, d => d.recipient);
  
  // 展平
  let links = [];
  linksData.forEach(([donor, recs]) => {
    recs.forEach(([recipient, amount]) => {
      links.push({ donor, recipient, amount });
    });
  });

  // Data Join
  const lines = linkLayer.selectAll(".link")
    .data(links, d => d.donor + "-" + d.recipient);

  // Exit: 以前有现在没有的，宽度变0
  lines.exit()
    .transition().duration(500)
    .attr("stroke-width", 0)
    .remove();

  // Enter: 新出现的，宽度从0开始
  const linesEnter = lines.enter()
    .append("line")
    .attr("class", "link")
    .attr("x1", donorX + 6)
    .attr("y1", d => yScaleDonor(d.donor) + yScaleDonor.bandwidth()/2)
    .attr("x2", recipientX - 6)
    .attr("y2", d => yScaleRecipient(d.recipient) + yScaleRecipient.bandwidth()/2)
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 0)
    .on("click", (e, d) => selectPair(d.donor, d.recipient))
    .on("mouseover", function(e, d) {
       d3.select(this).attr("stroke", "orange").attr("stroke-opacity", 1);
       tooltip.transition().duration(200).style("opacity", .9);
       tooltip.html(`<strong>${d.donor} -> ${d.recipient}</strong><br/>Year: ${currentYear}<br/>Amount: $${formatAmount(d.amount)}`)
         .style("left", (e.pageX + 10) + "px")
         .style("top", (e.pageY - 28) + "px");
    })
    .on("mouseout", function() {
       // 如果不是选中的，恢复原样
       const isSel = selectedPair && selectedPair.donor === d.donor && selectedPair.recipient === d.recipient;
       d3.select(this)
         .attr("stroke", isSel ? "red" : "#999")
         .attr("stroke-opacity", isSel ? 1 : 0.5);
       tooltip.transition().duration(500).style("opacity", 0);
    });

  // Update
  lines.merge(linesEnter)
    .transition().duration(500)
    .attr("stroke-width", d => widthScale(d.amount))
    .attr("stroke", d => {
      // 保持选中状态的高亮
      if (selectedPair && selectedPair.donor === d.donor && selectedPair.recipient === d.recipient) return "red";
      return "#999";
    })
    .attr("stroke-opacity", d => {
      if (selectedPair && selectedPair.donor === d.donor && selectedPair.recipient === d.recipient) return 1;
      return 0.5;
    });
    
    // 同时更新 Detail Chart 的垂直指示线（如果在播放）
    updateDetailCursor(year);
}

// === 交互逻辑 ===

function selectPair(donor, recipient) {
  selectedPair = { donor, recipient };
  selectedNode = null; // 清除节点选中
  // 重绘主图连线样式
  updateYear(currentYear); 
  // 更新下方图表
  updateDetailChart();
}

function selectNode(name, role) {
  selectedNode = { name, role };
  selectedPair = null;
  updateYear(currentYear);
  updateDetailChart();
}

function updateDetailChart() {
  detailG.selectAll("*").remove();
  
  // 准备数据
  let seriesData = []; // [{year, value}]
  let title = "";

  if (selectedPair) {
    // 显示这对关系的历年数据
    title = `${selectedPair.donor} to ${selectedPair.recipient} (Historical)`;
    years.forEach(y => {
      const rec = allData.find(d => d.year === y && d.donor === selectedPair.donor && d.recipient === selectedPair.recipient);
      seriesData.push({ year: y, value: rec ? rec.amount : 0 });
    });
  } else if (selectedNode) {
    // 显示该国总流出或流入
    title = `${selectedNode.name} (${selectedNode.role === 'donor' ? 'Total Donated' : 'Total Received'})`;
    years.forEach(y => {
      const relevant = allData.filter(d => d.year === y && d[selectedNode.role] === selectedNode.name);
      const sum = d3.sum(relevant, d => d.amount);
      seriesData.push({ year: y, value: sum });
    });
  } else {
    // 默认：所有 Top 国家的总交易量
    title = "Total Aid Flow (Top 20 Donors to Top 10 Recipients)";
    years.forEach(y => {
      const relevant = allData.filter(d => d.year === y);
      const sum = d3.sum(relevant, d => d.amount);
      seriesData.push({ year: y, value: sum });
    });
  }

  // 绘制折线图
  detailYScale.domain([0, d3.max(seriesData, d => d.value) || 1000]);

  // X轴
  detailG.append("g")
    .attr("transform", `translate(0, ${detailInnerH})`)
    .call(d3.axisBottom(detailXScale).tickFormat(d3.format("d")));

  // Y轴
  detailG.append("g")
    .call(d3.axisLeft(detailYScale).ticks(5).tickFormat(d3.format(".2s")));
  
  // 标题
  detailG.append("text")
    .attr("x", detailInnerW / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(title);

  // 线条生成器
  const lineGen = d3.line()
    .x(d => detailXScale(d.year))
    .y(d => detailYScale(d.value));

  detailG.append("path")
    .datum(seriesData)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", lineGen);
    
  // 绘制当前年份指示线
  updateDetailCursor(currentYear);
}

function updateDetailCursor(year) {
    // 移除旧的
    detailG.selectAll(".year-cursor").remove();
    
    const x = detailXScale(year);
    
    detailG.append("line")
        .attr("class", "year-cursor")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("y2", detailInnerH)
        .attr("stroke", "red")
        .attr("stroke-dasharray", "4 4")
        .attr("stroke-width", 1);
}

function setupControls(min, max) {
  const slider = d3.select(".controls").append("input")
    .attr("type", "range")
    .attr("id", "yearSlider")
    .attr("min", min)
    .attr("max", max)
    .attr("value", min)
    .on("input", function() {
      updateYear(+this.value);
      if (isPlaying) stopPlay(); // 用户手动拖动时停止播放
    });

  d3.select(".controls").append("span")
    .attr("id", "yearLabel")
    .style("margin-left", "10px")
    .style("font-weight", "bold")
    .text(min);

  d3.select(".controls").append("button")
    .text("Play")
    .style("margin-left", "20px")
    .on("click", function() {
      if (isPlaying) {
        stopPlay();
        d3.select(this).text("Play");
      } else {
        startPlay(max);
        d3.select(this).text("Pause");
      }
    });
}

function startPlay(maxYear) {
  isPlaying = true;
  if (currentYear >= maxYear) currentYear = years[0]; // 如果已到头，重头开始
  
  playInterval = setInterval(() => {
    if (currentYear >= maxYear) {
      stopPlay();
      d3.select("button").text("Play"); // Reset button text
      return;
    }
    updateYear(currentYear + 1);
  }, 800); // 800ms 一帧
}

function stopPlay() {
  isPlaying = false;
  clearInterval(playInterval);
}