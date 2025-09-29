// Establece la paleta de colores personalizada 
dc.config.defaultColors(['#a9cce3', '#5dade2', '#2980b9', '#2471a3', '#1f618d', '#154360']);

// La función fetchData
async function fetchData(endpoint, params = {}) {
  const url = new URL(`http://localhost:3000/api/${endpoint}`);
  Object.keys(params).forEach(k => {
    if (params[k]) url.searchParams.append(k, params[k]);
  });
  const res = await fetch(url);
  return res.json();
}

// Nombres de días y meses
const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const dayOrder = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const shortMonths = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Variables globales para control de gráficos y datos
let currentYearIndex = 0;
let availableYears = [];
let ndx; // Instancia de Crossfilter para acceder a los datos filtrados

function isValidDate(dateStr) {
  // Validar formato YYYY-MM-DD simple
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

async function loadDashboard(start, end) {
  try {
    const rawDataRes = await fetchData("data", { start, end });

    // Limpiar gráficos anteriores y sus contenedores HTML
    dc.chartRegistry.clear();
    document.getElementById("monthly-chart").innerHTML = "";
    document.getElementById("hourly-chart").innerHTML = "";
    document.getElementById("dow-chart").innerHTML = "";
    document.getElementById("types-chart").innerHTML = "";

    // Procesar datos crudos, validando fechas y añadiendo criterio_texto
    const data = (rawDataRes.data || [])
      .map(d => {
        const date = new Date(d.fecha);
        if (isNaN(date.getTime())) return null;
        return {
          date: date,
          year: date.getFullYear(),
          hour: date.getHours(),
          dow: dayNames[date.getDay()],
          tipo_busqueda: (d.tipo_busqueda === null || d.tipo_busqueda === undefined || d.tipo_busqueda === '') ? 'sin informacion' : d.tipo_busqueda,
          criterio_texto: d.criterio_texto || '' 
        };
      })
      .filter(d => d !== null);

    if (data.length === 0) {
      document.getElementById("yearLabel").innerText = "Sin datos";
      dc.renderAll();
      return;
    }

    // crossfilter accesible globalmente
    ndx = crossfilter(data);

    const monthlyDim = ndx.dimension(d => d3.timeMonth.floor(d.date));
    const monthlyGroup = monthlyDim.group().reduceCount();

    const hourlyDim = ndx.dimension(d => d.hour);
    const hourlyGroup = hourlyDim.group().reduceCount();

    const dowDim = ndx.dimension(d => d.dow);
    const dowGroup = dowDim.group().reduceCount();

    const typesDim = ndx.dimension(d => d.tipo_busqueda);
    const typesGroup = typesDim.group().reduceCount();

    availableYears = [...new Set(data.map(d => d.year))].sort();
    currentYearIndex = 0;

    const monthlyChart = dc.barChart("#monthly-chart");
    function renderYear(year) {
      monthlyDim.filterAll();
      monthlyChart
        .width(500).height(300)
        .margins({top: 10, right: 20, bottom: 60, left: 70})
        .dimension(monthlyDim).group(monthlyGroup)
        .x(d3.scaleTime().domain([new Date(year,0,1), new Date(year,11,31)]))
        .xUnits(d3.timeMonths)
        .brushOn(true).elasticY(true).renderHorizontalGridLines(true);
      monthlyChart.xAxis().tickFormat(d => d && d.getMonth ? shortMonths[d.getMonth()] : '');
      monthlyChart.yAxis().ticks(6);
      monthlyChart.yAxisLabel("Total Búsquedas");
      document.getElementById("yearLabel").innerText = year;
      dc.renderAll();
      updateNavButtons();
    }

    if (availableYears.length > 0) renderYear(availableYears[currentYearIndex]);
    else {
      document.getElementById("yearLabel").innerText = "Sin datos";
      updateNavButtons();
    }

    document.getElementById("prevYear").onclick = () => {
      if (currentYearIndex > 0) renderYear(availableYears[--currentYearIndex]);
    };
    document.getElementById("nextYear").onclick = () => {
      if (currentYearIndex < availableYears.length - 1) renderYear(availableYears[++currentYearIndex]);
    };

    function updateNavButtons() {
      const prev = document.getElementById("prevYear");
      const next = document.getElementById("nextYear");
      prev.disabled = currentYearIndex === 0 || availableYears.length === 0;
      next.disabled = currentYearIndex >= availableYears.length - 1 || availableYears.length === 0;
      prev.classList.toggle('disabled', prev.disabled);
      next.classList.toggle('disabled', next.disabled);
    }

    const hourlyChart = dc.barChart("#hourly-chart");
    hourlyChart
      .width(500).height(250)
      .margins({top: 10, right: 20, bottom: 30, left: 70})
      .dimension(hourlyDim).group(hourlyGroup)
      .x(d3.scaleLinear().domain([0, 24]).rangeRound([0, 500]))
      .xUnits(dc.units.integers)
      .brushOn(true).renderHorizontalGridLines(true)
      .yAxisLabel("Total Búsquedas");

    const dowChart = dc.rowChart("#dow-chart");
    dowChart
      .width(400).height(250)
      .dimension(dowDim).group(dowGroup)
      .ordering(d => dayOrder.indexOf(d.key))
      .elasticX(true).xAxis().ticks(4);

    const typesChart = dc.pieChart("#types-chart");
    typesChart
      .width(400).height(300)
      .dimension(typesDim).group(typesGroup)
      .innerRadius(50);

    dc.renderAll();

  } catch (error) {
    console.error("Error cargando datos:", error);
    document.getElementById("yearLabel").innerText = "Error cargando datos";
    dc.chartRegistry.clear();
    dc.renderAll();
  }
}

document.getElementById("applyFilters").addEventListener("click", () => {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  if (start && !isValidDate(start)) return alert("Fecha de inicio inválida. Use formato AAAA-MM-DD.");
  if (end && !isValidDate(end)) return alert("Fecha de fin inválida. Use formato AAAA-MM-DD.");
  if (start && end && start > end) return alert("La fecha de inicio no puede ser mayor que la fecha de fin.");
  loadDashboard(start, end);
});

const modal = document.getElementById("wordCloudModal");
const closeBtn = document.querySelector(".close-button");
closeBtn.onclick = () => modal.style.display = "none";
window.onclick = event => {
  if (event.target == modal) modal.style.display = "none";
};

// --- LÓGICA DE LA NUBE DE PALABRAS CON FILTRO DE SOLO LETRAS Y DEPURACIÓN ---
document.getElementById("generateWordCloud").addEventListener("click", () => {
  const chartContainer = document.getElementById("word-cloud-chart-modal");
  chartContainer.innerHTML = "";
  modal.style.display = "block";

  if (!ndx) {
    chartContainer.innerHTML = "<p style='text-align: center; padding-top: 20px;'>No hay datos para mostrar. Aplica un filtro primero.</p>";
    return;
  }
  
  const wordCounts = {};
  const filteredData = ndx.allFiltered();
  

  // Función para validar que la palabra contenga solo letras (incluye letras acentuadas y ñ)
  const isValidWord = word => /^[a-záéíóúñ]+$/i.test(word);

  console.log("Ejemplos de criterio_texto de los primeros 5 registros:");
  filteredData.slice(0, 5).forEach((d, i) => {
    console.log(`Registro ${i + 1}:`, d.criterio_texto);
  });

  filteredData.forEach(d => {
    if (d.criterio_texto) {
      // Divide el texto por cualquier caracter que no sea una letra, y filtra elementos vacíos.
      const words = d.criterio_texto.toLowerCase().split(/\W+/).filter(Boolean);
      words.forEach(word => {
        if (isValidWord(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    }
  });


  const wordData = Object.entries(wordCounts);

  if (wordData.length === 0) {
    chartContainer.innerHTML = "<p style='text-align: center; padding-top: 20px;'>No se encontraron palabras válidas en los criterios de búsqueda para el rango seleccionado.</p>";
    return;
  }

  if (typeof WordCloud !== 'undefined') {
    WordCloud(chartContainer, {
      list: wordData,
      gridSize: Math.round(16 * chartContainer.clientWidth / 1024),
      weightFactor: size => Math.log(size + 1) * 6,
      fontFamily: 'Arial, sans-serif',
      color: 'random-dark',
      rotateRatio: 0.5,
      minSize: 10
    });
  } else {
    chartContainer.innerHTML = "<p style='text-align: center; padding-top: 20px; color: red;'>Error: La librería WordCloud no está cargada.</p>";
  }
});

loadDashboard();


