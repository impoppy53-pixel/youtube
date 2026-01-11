/* Main app logic: navigation + load CSV + build charts and table */

let RAW = [];
let FILTERED = [];
let charts = {};
let page = 1;
const pageSize = 20;

const palette = [
  "#6d5efc","#00c6ff","#ff4ecd","#00c389","#ffb020",
  "#ff6b6b","#12b5e5","#845ef7","#f06595","#82c91e",
  "#f59f00","#20c997","#339af0","#e64980","#15aabf"
];

function fmt(n){
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toLocaleString("th-TH");
}

function trendingToISO(trend){
  // input example: "17.14.11" => 2017-11-14
  if (!trend || typeof trend !== "string" || !trend.includes(".")) return null;
  const parts = trend.split(".");
  if (parts.length !== 3) return null;
  const [yy, dd, mm] = parts;
  return `20${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
}

function pick(el){ return document.getElementById(el); }

function setStatus(text){
  const s = pick("loadStatus");
  if (s) s.textContent = text;
}

/* -------- Navigation -------- */
function initNav(){
  const nav = document.getElementById("nav");
  const pageTitle = pick("pageTitle");
  const pageSubtitle = pick("pageSubtitle");

  const meta = {
    "sec-about": {
      title: "เกี่ยวกับข้อมูล",
      sub: "สรุปภาพรวมชุดข้อมูลและสถานะการทำความสะอาด"
    },
    "sec-steps": {
      title: "ขั้นตอนและวิธีจัดการข้อมูล",
      sub: "ลำดับการทำงานตั้งแต่รวบรวม → ตรวจสอบ → ทำความสะอาด → สรุปผล"
    },
    "sec-dashboard": {
      title: "แดชบอร์ดข้อมูล",
      sub: "ตัวกรอง + กราฟหลายรูปแบบ + ตารางข้อมูล"
    },
    "sec-author": {
      title: "ข้อมูลผู้จัดทำ",
      sub: "เครดิตผู้จัดทำและแนวทางนำเสนอ"
    }
  };

  nav.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      nav.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.target;
      document.querySelectorAll(".section").forEach(sec=>sec.classList.remove("show"));
      document.getElementById(target).classList.add("show");

      pageTitle.textContent = meta[target].title;
      pageSubtitle.textContent = meta[target].sub;

      // when entering dashboard, re-render chart sizes
      if (target === "sec-dashboard"){
        Object.values(charts).forEach(ch => ch?.resize());
      }
    });
  });
}


/* -------- Data source helpers (Mac-safe) -------- */
let DATA_SOURCE = "bundled"; // bundled | uploaded

function setDataSourceText(text){
  const a = document.getElementById("dataSourceLine");
  const d = document.getElementById("dataSourceLine2");
  if (a) a.innerHTML = text;
  if (d) d.innerHTML = text;
}

function wireUploadButtons(){
  const fileInput = document.getElementById("csvFileInput");
  const openPicker = () => fileInput && fileInput.click();

  const btn1 = document.getElementById("uploadCsvBtn");
  const btn2 = document.getElementById("uploadCsvBtn2");
  const btn3 = document.getElementById("uploadCsvBtnDash");
  [btn1, btn2, btn3].forEach(b => b && b.addEventListener("click", openPicker));

  const useBundled = () => { DATA_SOURCE = "bundled"; setStatus(isRetry ? "กำลังอ่านไฟล์ youtube.csv …" : "กำลังอ่านไฟล์ youtube.csv …"); setDataSourceText('กำลังอ่านจาก <b>assets/data/youtube.csv</b> (แนะนำเปิดผ่าน Live Server)'); loadCSVBundled(true); };
  const b1 = document.getElementById("useBundledBtn");
  const b2 = document.getElementById("useBundledBtnDash");
  if (b1) b1.addEventListener("click", useBundled);
  if (b2) b2.addEventListener("click", useBundled);

  if (fileInput){
    fileInput.addEventListener("change", (e)=>{
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      loadFromFile(file);
      // reset to allow re-upload same file
      fileInput.value = "";
    });
  }
}

function loadFromFile(file){
  DATA_SOURCE = "uploaded";
  setStatus(`กำลังอ่านไฟล์จากเครื่อง: ${file.name} …`);
  setDataSourceText(`กำลังอ่านจากไฟล์ที่อัปโหลด: <b>${file.name}</b> (Mac-safe)`);
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (res) => {
      RAW = res.data || [];
      RAW.forEach(r=>{ r.trending_iso = trendingToISO(r.trending_date); });
      afterDataLoaded();
      setStatus("โหลดข้อมูลจากไฟล์อัปโหลดสำเร็จ ✅");
    },
    error: (err) => {
      console.error(err);
      setStatus("อ่านไฟล์อัปโหลดไม่สำเร็จ ❌");
      alert("อ่านไฟล์ CSV ไม่ได้: กรุณาเลือกไฟล์ .csv ที่ถูกต้อง");
    }
  });
}

function afterDataLoaded(){
  initAbout();
  initFilters();
  buildDashboard();
  applyFilters();
}

/* -------- Load CSV -------- */
function loadCSVBundled(isRetry=false){
  setStatus(isRetry ? "กำลังอ่านไฟล์ youtube.csv …" : "กำลังอ่านไฟล์ youtube.csv …");

  Papa.parse("assets/data/youtube.csv", {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    worker: true,
    complete: (res) => {
      RAW = res.data || [];
      // Add ISO trending date for filtering
      RAW.forEach(r=>{
        r.trending_iso = trendingToISO(r.trending_date);
      });

      setStatus("โหลดข้อมูลสำเร็จ ✅");
      afterDataLoaded();
    },
    error: (err) => {
      console.error(err);
      setStatus("โหลดข้อมูลไม่สำเร็จ ❌ (Mac มักติด CORS)");
      initAbout(true);
      setDataSourceText('อ่านไฟล์จาก <b>assets/data/youtube.csv</b> ไม่ได้ (อาจติด CORS) — กรุณากด “เลือกไฟล์ CSV” เพื่ออัปโหลดจากเครื่อง');
    }
  });
}


function loadCSV(){
  // default: try bundled file (works when served via Live Server)
  loadCSVBundled(false);
}

/* -------- ABOUT page -------- */
function initAbout(useDefaults=false){
  const d = window.__DEFAULTS__ || {};
  const rows = useDefaults ? d.rows : RAW.length;
  const cols = useDefaults ? d.cols : Object.keys(RAW[0] || {}).length - 1; // excluding trending_iso

  pick("kpiRows").textContent = fmt(rows);
  pick("kpiCols").textContent = fmt(cols);

  const errorCount = useDefaults ? d.error_count : RAW.reduce((a,r)=> a + (r.video_error_or_removed ? 1 : 0), 0);
  pick("kpiErrors").textContent = fmt(errorCount);

  pick("missingTxt").textContent = useDefaults ? "ไม่พบ" : "ไม่พบ (0 ช่องว่าง)";
  pick("formatTxt").textContent = `${fmt(cols)} คอลัมน์`;

  const ready = rows > 0 ? ((rows - errorCount)/rows*100) : 0;
  pick("readyTxt").textContent = `พร้อมใช้งาน ${ready.toFixed(2)}%`;

  // Facts
  if (useDefaults){
    pick("factDateRange").textContent = `${d.date_min} → ${d.date_max}`;
    pick("factUniqueVideos").textContent = fmt(d.unique_videos);
    pick("factUniqueChannels").textContent = fmt(d.unique_channels);
    pick("factCats").textContent = fmt(d.cat_count);
    pick("factCountries").textContent = (d.countries || []).join(", ");
    setTopCards(d);
    buildColChips(Object.keys(d.top_view || {}).length ? null : null, Object.keys(RAW[0]||{}));
  } else {
    const dates = RAW.map(r=>r.trending_iso).filter(Boolean).sort();
    pick("factDateRange").textContent = `${dates[0]} → ${dates[dates.length-1]}`;
    pick("factUniqueVideos").textContent = fmt(new Set(RAW.map(r=>r.video_id)).size);
    pick("factUniqueChannels").textContent = fmt(new Set(RAW.map(r=>r.channel_title)).size);
    pick("factCats").textContent = fmt(new Set(RAW.map(r=>r.category_id)).size);
    pick("factCountries").textContent = Array.from(new Set(RAW.map(r=>r.publish_country))).sort().join(", ");

    const topView = RAW.reduce((best,r)=> (best==null || r.views>best.views) ? r : best, null);
    const topLike = RAW.reduce((best,r)=> (best==null || r.likes>best.likes) ? r : best, null);
    const topCom = RAW.reduce((best,r)=> (best==null || r.comment_count>best.comment_count) ? r : best, null);

    setTopCards({
      top_view: { title: topView?.title, channel_title: topView?.channel_title, views: topView?.views, publish_country: topView?.publish_country },
      top_like: { title: topLike?.title, channel_title: topLike?.channel_title, likes: topLike?.likes, publish_country: topLike?.publish_country },
      top_comment: { title: topCom?.title, channel_title: topCom?.channel_title, comment_count: topCom?.comment_count, publish_country: topCom?.publish_country }
    });

    buildColChips(Object.keys(RAW[0] || {}).filter(c=>c!=="trending_iso"));
  }

  // Clean donut
  buildCleanDonut(rows, errorCount);
}

function setTopCards(d){
  const v = d.top_view || {};
  const l = d.top_like || {};
  const c = d.top_comment || {};
  pick("topViewTitle").textContent = v.title || "—";
  pick("topViewMeta").textContent = `${v.channel_title || "—"} · views ${fmt(v.views)} · ${v.publish_country || ""}`;
  pick("topLikeTitle").textContent = l.title || "—";
  pick("topLikeMeta").textContent = `${l.channel_title || "—"} · likes ${fmt(l.likes)} · ${l.publish_country || ""}`;
  pick("topCommentTitle").textContent = c.title || "—";
  pick("topCommentMeta").textContent = `${c.channel_title || "—"} · comments ${fmt(c.comment_count)} · ${c.publish_country || ""}`;
}

function buildColChips(cols){
  const root = pick("colChips");
  root.innerHTML = "";
  (cols || []).forEach((c,i)=>{
    const div = document.createElement("span");
    div.className = "chip";
    div.textContent = c;
    root.appendChild(div);
  });
}

function buildCleanDonut(rows, errors){
  const ok = Math.max(0, rows - errors);
  const ctx = document.getElementById("cleanDonut");
  if (!ctx) return;

  if (charts.cleanDonut) charts.cleanDonut.destroy();

  charts.cleanDonut = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["พร้อมใช้งาน", "Error/Removed"],
      datasets: [{
        data: [ok, errors],
        backgroundColor: ["#00c389", "#ff4ecd"],
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (x)=> `${x.label}: ${fmt(x.raw)}` } }
      },
      cutout: "70%"
    }
  });
}

/* -------- Filters -------- */
function initFilters(){
  const fCountry = pick("fCountry");
  const fCategory = pick("fCategory");
  const fTimeframe = pick("fTimeframe");
  const fWeekday = pick("fWeekday");
  const fDateMin = pick("fDateMin");
  const fDateMax = pick("fDateMax");

  const uniq = (arr) => Array.from(new Set(arr.filter(v=>v!==null && v!==undefined && v!=="")));

  uniq(RAW.map(r=>r.publish_country)).sort().forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    fCountry.appendChild(opt);
  });

  uniq(RAW.map(r=>r.category_id)).sort((a,b)=>a-b).forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    fCategory.appendChild(opt);
  });

  uniq(RAW.map(r=>r.time_frame)).sort().forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    fTimeframe.appendChild(opt);
  });

  uniq(RAW.map(r=>r.published_day_of_week)).sort().forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    fWeekday.appendChild(opt);
  });

  // date range
  const dates = RAW.map(r=>r.trending_iso).filter(Boolean).sort();
  const min = dates[0], max = dates[dates.length-1];
  fDateMin.value = min;
  fDateMax.value = max;
  fDateMin.min = min; fDateMin.max = max;
  fDateMax.min = min; fDateMax.max = max;

  // listeners
  [fCountry,fCategory,fTimeframe,fWeekday,fDateMin,fDateMax].forEach(el=>{
    el.addEventListener("change", ()=>{ page=1; applyFilters(); });
  });

  pick("resetBtn").addEventListener("click", ()=>{
    fCountry.value = "";
    fCategory.value = "";
    fTimeframe.value = "";
    fWeekday.value = "";
    fDateMin.value = min;
    fDateMax.value = max;
    page = 1;
    applyFilters();
  });

  pick("prevPage").addEventListener("click", ()=>{ if (page>1){ page--; renderTable(); } });
  pick("nextPage").addEventListener("click", ()=>{
    const maxPage = Math.max(1, Math.ceil(FILTERED.length / pageSize));
    if (page < maxPage){ page++; renderTable(); }
  });
}

function applyFilters(){
  const country = pick("fCountry").value;
  const cat = pick("fCategory").value;
  const tf = pick("fTimeframe").value;
  const wd = pick("fWeekday").value;
  const dmin = pick("fDateMin").value;
  const dmax = pick("fDateMax").value;

  FILTERED = RAW.filter(r=>{
    if (country && r.publish_country !== country) return false;
    if (cat && String(r.category_id) !== String(cat)) return false;
    if (tf && r.time_frame !== tf) return false;
    if (wd && r.published_day_of_week !== wd) return false;

    if (r.trending_iso){
      if (dmin && r.trending_iso < dmin) return false;
      if (dmax && r.trending_iso > dmax) return false;
    }
    return true;
  });

  updateStats();
  updateCharts();
  renderTable();
}

/* -------- Dashboard stats -------- */
function updateStats(){
  pick("statRows").textContent = fmt(FILTERED.length);

  const sumViews = FILTERED.reduce((a,r)=>a + (r.views||0), 0);
  const sumLikes = FILTERED.reduce((a,r)=>a + (r.likes||0), 0);
  const sumCom = FILTERED.reduce((a,r)=>a + (r.comment_count||0), 0);

  pick("statViews").textContent = fmt(sumViews);
  pick("statLikes").textContent = fmt(sumLikes);
  pick("statComments").textContent = fmt(sumCom);
}

/* -------- Charts -------- */
function buildDashboard(){
  // Create empty charts first
  charts.topChannels = new Chart(document.getElementById("chTopChannels"), mkBarCfg([], [], "Views"));
  charts.category = new Chart(document.getElementById("chCategory"), mkDoughnutCfg([], [], "Views"));
  charts.trendLine = new Chart(document.getElementById("chTrendLine"), mkLineCfg([], [], "Count"));
  charts.scatter = new Chart(document.getElementById("chScatter"), mkScatterCfg([]));
  charts.weekday = new Chart(document.getElementById("chWeekday"), mkBarCfg([], [], "Views"));
}

function mkBarCfg(labels, data, label){
  return {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: labels.map((_,i)=> palette[i % palette.length]),
        borderWidth: 0,
        borderRadius: 12
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#344054" }, grid: { display:false } },
        y: { ticks: { color: "#344054" } }
      }
    }
  };
}

function mkDoughnutCfg(labels, data, label){
  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: labels.map((_,i)=> palette[i % palette.length]),
        borderWidth: 0
      }]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      cutout: "65%"
    }
  };
}

function mkLineCfg(labels, data, label){
  return {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: "#6d5efc",
        backgroundColor: "rgba(109,94,252,.18)",
        fill: true,
        tension: 0.35,
        pointRadius: 0
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#344054", maxTicksLimit: 8 } },
        y: { ticks: { color: "#344054" } }
      }
    }
  };
}

function mkScatterCfg(points){
  return {
    type: "scatter",
    data: {
      datasets: [{
        label: "views vs likes",
        data: points,
        backgroundColor: "rgba(0,198,255,.65)"
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#344054" }, title: { display:true, text:"views" } },
        y: { ticks: { color: "#344054" }, title: { display:true, text:"likes" } }
      }
    }
  };
}

function updateCharts(){
  // Top channels by views
  const byChannel = new Map();
  for (const r of FILTERED){
    const k = r.channel_title || "(unknown)";
    byChannel.set(k, (byChannel.get(k)||0) + (r.views||0));
  }
  const top10 = Array.from(byChannel.entries())
    .sort((a,b)=>b[1]-a[1]).slice(0,10);
  const chLabels = top10.map(x=>x[0]);
  const chData = top10.map(x=>x[1]);

  charts.topChannels.data.labels = chLabels;
  charts.topChannels.data.datasets[0].data = chData;
  charts.topChannels.data.datasets[0].backgroundColor = chLabels.map((_,i)=>palette[i%palette.length]);
  charts.topChannels.update();

  // Category distribution (views)
  const byCat = new Map();
  for (const r of FILTERED){
    const k = String(r.category_id);
    byCat.set(k, (byCat.get(k)||0) + (r.views||0));
  }
  const cats = Array.from(byCat.entries()).sort((a,b)=>b[1]-a[1]).slice(0,12);
  charts.category.data.labels = cats.map(x=>x[0]);
  charts.category.data.datasets[0].data = cats.map(x=>x[1]);
  charts.category.data.datasets[0].backgroundColor = cats.map((_,i)=>palette[i%palette.length]);
  charts.category.update();

  // Trend line: count per day
  const byDate = new Map();
  for (const r of FILTERED){
    const k = r.trending_iso || trendingToISO(r.trending_date) || "";
    if (!k) continue;
    byDate.set(k, (byDate.get(k)||0) + 1);
  }
  const dates = Array.from(byDate.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  charts.trendLine.data.labels = dates.map(x=>x[0]);
  charts.trendLine.data.datasets[0].data = dates.map(x=>x[1]);
  charts.trendLine.update();

  // Scatter sample (limit points)
  const sample = [];
  const step = Math.max(1, Math.floor(FILTERED.length / 1500));
  for (let i=0;i<FILTERED.length;i+=step){
    const r = FILTERED[i];
    if (r.views != null && r.likes != null){
      sample.push({x: r.views, y: r.likes});
    }
    if (sample.length >= 1500) break;
  }
  charts.scatter.data.datasets[0].data = sample;
  charts.scatter.update();

  // Weekday views
  const byW = new Map();
  for (const r of FILTERED){
    const k = r.published_day_of_week || "(unknown)";
    byW.set(k, (byW.get(k)||0) + (r.views||0));
  }
  const w = Array.from(byW.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
  charts.weekday.data.labels = w.map(x=>x[0]);
  charts.weekday.data.datasets[0].data = w.map(x=>x[1]);
  charts.weekday.data.datasets[0].backgroundColor = w.map((_,i)=>palette[i%palette.length]);
  charts.weekday.update();
}

/* -------- Table pagination -------- */
function renderTable(){
  const tbody = pick("dataTable");
  tbody.innerHTML = "";

  const maxPage = Math.max(1, Math.ceil(FILTERED.length / pageSize));
  if (page > maxPage) page = maxPage;

  const start = (page-1)*pageSize;
  const slice = FILTERED.slice(start, start+pageSize);

  for (const r of slice){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge text-bg-light">${r.trending_date || ""}</span></td>
      <td class="text-truncate" style="max-width: 520px;" title="${(r.title||"").replaceAll('"','&quot;')}">${r.title || ""}</td>
      <td>${r.channel_title || ""}</td>
      <td><span class="badge text-bg-secondary">${r.category_id ?? ""}</span></td>
      <td><span class="badge text-bg-info">${r.publish_country || ""}</span></td>
      <td class="text-end">${fmt(r.views)}</td>
      <td class="text-end">${fmt(r.likes)}</td>
      <td class="text-end">${fmt(r.comment_count)}</td>
    `;
    tbody.appendChild(tr);
  }

  pick("pageInfo").textContent = `หน้า ${page} / ${maxPage} · แสดง ${fmt(slice.length)} แถว จากทั้งหมด ${fmt(FILTERED.length)} แถว`;
}


async function exportPDF(){
  // Export current visible section as a report-style PDF (A4, multi-page)
  try{
    const btn = document.getElementById("exportPdfBtn");
    if (btn) { btn.disabled = true; btn.textContent = "กำลังสร้าง PDF…"; }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const margin = 10; // mm
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // capture: visible section + topbar title as header
    const visible = document.querySelector(".section.show");
    const title = document.getElementById("pageTitle")?.textContent || "Youbube Report";
    const subtitle = document.getElementById("pageSubtitle")?.textContent || "";

    // Temporarily expand charts to render sharply
    await new Promise(r => setTimeout(r, 200));

    // Create a wrapper clone for clean capture
    const wrap = document.createElement("div");
    wrap.style.position = "fixed";
    wrap.style.left = "-99999px";
    wrap.style.top = "0";
    wrap.style.width = "1200px"; // bigger for sharpness
    wrap.style.padding = "20px";
    wrap.style.background = "white";
    wrap.style.fontFamily = getComputedStyle(document.body).fontFamily;

    const header = document.createElement("div");
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="font-weight:800;font-size:18px;">${title}</div>
        <div style="color:#667085;font-size:12px;">${subtitle}</div>
      </div>
      <div style="height:4px;border-radius:999px;background:linear-gradient(90deg,#00c6ff,#6d5efc,#ff4ecd);margin-bottom:14px;"></div>
    `;
    wrap.appendChild(header);

    const clone = visible.cloneNode(true);
    // remove any buttons that shouldn't be in report
    clone.querySelectorAll("button").forEach(b=>b.style.display="none");
    wrap.appendChild(clone);

    const footer = document.createElement("div");
    footer.style.marginTop = "14px";
    footer.style.fontSize = "11px";
    footer.style.color = "#667085";
    const now = new Date();
    footer.textContent = `Generated by Youbube · ${now.toLocaleString("th-TH")}`;
    wrap.appendChild(footer);

    document.body.appendChild(wrap);

    const canvas = await html2canvas(wrap, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    document.body.removeChild(wrap);

    const imgData = canvas.toDataURL("image/png");
    const imgW = pageW - margin*2;
    const imgH = canvas.height * imgW / canvas.width;

    let y = 0;
    let remaining = imgH;

    // Add first page
    pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
    remaining -= (pageH - margin*2);

    // Additional pages (by shifting image up)
    while (remaining > 0){
      pdf.addPage();
      y += (pageH - margin*2);
      // draw same big image but moved up (negative y)
      pdf.addImage(imgData, "PNG", margin, margin - y, imgW, imgH);
      remaining -= (pageH - margin*2);
    }

    pdf.save(`Youbube_Report_${title.replaceAll(" ","_")}.pdf`);

  }catch(err){
    console.error(err);
    alert("Export PDF ไม่สำเร็จ: กรุณาเปิดผ่าน Live Server และลองใหม่อีกครั้ง");
  }finally{
    const btn = document.getElementById("exportPdfBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Export PDF (รายงาน)"; }
  }
}


/* -------- Boot -------- */
document.addEventListener("DOMContentLoaded", ()=>{
  initNav();
  wireUploadButtons();
  setDataSourceText('กำลังพยายามอ่านจาก <b>assets/data/youtube.csv</b> (แนะนำเปิดผ่าน Live Server)');
  const exportBtn = document.getElementById("exportPdfBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportPDF);
  loadCSV();
});
