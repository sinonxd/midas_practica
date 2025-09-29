// Soluciona la advertencia de colores y establece un esquema compatible con D3v5
dc.config.defaultColors(d3.schemeCategory10);

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

// Control de años
let currentYearIndex = 0;
let availableYears = [];

function isValidDate(dateStr) {
  // Validar formato YYYY-MM-DD simple
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

async function loadDashboard(start, end) {
  try {
    const rawDataRes = await fetchData("data", { start, end });

    // Limpiamos gráficos anteriores y sus contenedores HTML
    dc.chartRegistry.clear();
    document.getElementById("monthly-chart").innerHTML = "";
    document.getElementById("hourly-chart").innerHTML = "";
    document.getElementById("dow-chart").innerHTML = "";
    document.getElementById("types-chart").innerHTML = "";

    // Procesar datos crudos, validando fechas
    const data = (rawDataRes.data || [])
      .map(d => {
        const date = new Date(d.fecha);
        // Si la fecha es inválida, el registro se descarta
        if (isNaN(date.getTime())) {
          return null;
        }
        return {
          date: date,
          year: date.getFullYear(),
          hour: date.getHours(),
          dow: dayNames[date.getDay()],
          tipo_busqueda: (d.tipo_busqueda === null || d.tipo_busqueda === undefined || d.tipo_busqueda === '') ? 'sin informacion' : d.tipo_busqueda
        };
      })
      .filter(d => d !== null); // Filtra los registros nulos (con fecha inválida)

    // Si no hay datos válidos
    if (data.length === 0) {
      document.getElementById("yearLabel").innerText = "Sin datos";
      dc.renderAll();
      return;
    }

    // Crossfilter
    const ndx = crossfilter(data);

    // Dimensiones y grupos
    const monthlyDim = ndx.dimension(d => d3.timeMonth.floor(d.date));
    const monthlyGroup = monthlyDim.group().reduceCount();

    const hourlyDim = ndx.dimension(d => d.hour);
    const hourlyGroup = hourlyDim.group().reduceCount();

    const dowDim = ndx.dimension(d => d.dow);
    const dowGroup = dowDim.group().reduceCount();

    const typesDim = ndx.dimension(d => d.tipo_busqueda);
    const typesGroup = typesDim.group().reduceCount();

    // Detectar años
    availableYears = [...new Set(data.map(d => d.year))].sort();
    currentYearIndex = 0;

    // Monthly chart (no filtrado global al navegar — sólo cambiamos dominio x)
    const monthlyChart = dc.barChart("#monthly-chart");
    function renderYear(year) {
      // Aseguramos que no exista filtro por año aplicado por navegación
      monthlyDim.filterAll();

      monthlyChart
        .width(500)
        .height(300)
        .margins({top: 10, right: 20, bottom: 60, left: 70})
        .dimension(monthlyDim)
        .group(monthlyGroup)
        .x(d3.scaleTime().domain([new Date(year,0,1), new Date(year,11,31)]))
        .xUnits(d3.timeMonths)
        .brushOn(true)
        .elasticY(true)
        .renderHorizontalGridLines(true);

      // Abreviar meses en español
      monthlyChart.xAxis().tickFormat(function(d){
        if (!d || !d.getMonth) return '';
        return shortMonths[d.getMonth()];
      });

      monthlyChart.yAxis().ticks(6);
      // Label de Y se coloca con margen izquierdo suficiente
      monthlyChart.yAxisLabel("Total Búsquedas");

      document.getElementById("yearLabel").innerText = year;
      dc.renderAll();
      updateNavButtons();
    }

    // Inicializar con el primer año disponible
    if (availableYears.length > 0) {
      renderYear(availableYears[currentYearIndex]);
    } else {
      document.getElementById("yearLabel").innerText = "Sin datos";
      updateNavButtons();
    }


    // Botones de navegación
    document.getElementById("prevYear").onclick = () => {
      if (currentYearIndex > 0) {
        currentYearIndex--;
        renderYear(availableYears[currentYearIndex]);
      }
    };
    document.getElementById("nextYear").onclick = () => {
      if (currentYearIndex < availableYears.length - 1) {
        currentYearIndex++;
        renderYear(availableYears[currentYearIndex]);
      }
    };

    function updateNavButtons() {
      const prev = document.getElementById("prevYear");
      const next = document.getElementById("nextYear");
      prev.disabled = currentYearIndex === 0 || availableYears.length === 0;
      next.disabled = currentYearIndex >= availableYears.length - 1 || availableYears.length === 0;
      // estilo visual cuando esté disabled
      prev.classList.toggle('disabled', prev.disabled);
      next.classList.toggle('disabled', next.disabled);
    }

    // Hourly chart
    const hourlyChart = dc.barChart("#hourly-chart");
    hourlyChart
      .width(500).height(250)
      .dimension(hourlyDim)
      .group(hourlyGroup)
      .x(d3.scaleLinear().domain([0, 24]).rangeRound([0, 500]))
      .xUnits(dc.units.integers)
      .brushOn(true)
      .renderHorizontalGridLines(true)
      .yAxisLabel("Total Búsquedas");

    // DOW chart
    const dowChart = dc.rowChart("#dow-chart");
    dowChart
      .width(400).height(250)
      .dimension(dowDim)
      .group(dowGroup)
      .ordering(d => dayOrder.indexOf(d.key))
      .elasticX(true)
      .xAxis().ticks(4);

    // Types chart (dona)
    const typesChart = dc.pieChart("#types-chart");
    typesChart
      .width(400).height(300)
      .dimension(typesDim)
      .group(typesGroup)
      .innerRadius(50);

    // Render inicial de los demás charts (monthly se renderiza en renderYear)
    dc.renderAll();

  } catch (error) {
    console.error("Error cargando datos:", error);
    document.getElementById("yearLabel").innerText = "Error cargando datos";
    dc.chartRegistry.clear();
    dc.renderAll();
  }
}

// --- Inicializar eventos ---
document.getElementById("applyFilters").addEventListener("click", () => {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (start && !isValidDate(start)) {
    alert("Fecha de inicio inválida. Use formato AAAA-MM-DD.");
    return;
  }
  if (end && !isValidDate(end)) {
    alert("Fecha de fin inválida. Use formato AAAA-MM-DD.");
    return;
  }
  if (start && end && start > end) {
    alert("La fecha de inicio no puede ser mayor que la fecha de fin.");
    return;
  }

  loadDashboard(start, end);
});

// Primera carga sin filtros
loadDashboard();


