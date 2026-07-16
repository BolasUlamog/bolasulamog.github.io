// Elements
const sheetUrlInput = document.getElementById('sheet-url');
const loadBtn = document.getElementById('load-btn');
const statusMessage = document.getElementById('status-message');
const tabsGroup = document.getElementById('tabs-group');
const tabsList = document.getElementById('tabs-list');
const plotBtn = document.getElementById('plot-btn');
const zeroInterceptToggle = document.getElementById('zero-intercept-toggle');
const plotContainer = document.getElementById('plot-container');

// Global State
let parsedWorkbook = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedUrl = localStorage.getItem('pgraph_sheet_url');
    if (savedUrl) {
        sheetUrlInput.value = savedUrl;
    }
});

// Update status message
function setStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
}

// Extract Sheet ID from URL
function extractSheetId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

// Load Data
loadBtn.addEventListener('click', async () => {
    const url = sheetUrlInput.value.trim();
    if (!url) {
        setStatus('Please enter a Google Sheet URL', 'error');
        return;
    }

    const sheetId = extractSheetId(url);
    if (!sheetId) {
        setStatus('Invalid Google Sheet URL. Make sure it contains /d/ID', 'error');
        return;
    }

    // Save to localStorage
    localStorage.setItem('pgraph_sheet_url', url);

    setStatus('Fetching spreadsheet data...', 'loading');
    tabsGroup.style.display = 'none';
    parsedWorkbook = null;

    try {
        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error('Failed to fetch data. Ensure the sheet is public ("Anyone with link can view").');
        }

        const arrayBuffer = await response.arrayBuffer();
        
        // Parse with SheetJS
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        parsedWorkbook = workbook;

        // Populate tabs
        tabsList.innerHTML = '';
        workbook.SheetNames.forEach((name, index) => {
            const label = document.createElement('label');
            label.className = 'toggle-container';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = name;
            checkbox.checked = true; // Default to checked
            
            const checkmark = document.createElement('span');
            checkmark.className = 'checkmark';
            
            label.appendChild(checkbox);
            label.appendChild(checkmark);
            label.appendChild(document.createTextNode(name));
            
            tabsList.appendChild(label);
        });

        tabsGroup.style.display = 'flex';
        setStatus('Spreadsheet loaded successfully!', 'success');
        
        // Auto-plot
        plotData();
        
    } catch (err) {
        setStatus(err.message, 'error');
        console.error(err);
    }
});

plotBtn.addEventListener('click', plotData);
zeroInterceptToggle.addEventListener('change', () => {
    if (parsedWorkbook) plotData();
});

// Linear Regression Engine
function linearRegression(x, y, forceZeroIntercept) {
    let n = x.length;
    if (n === 0) return { slope: 0, intercept: 0, r2: 0, fitX: [], fitY: [] };

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for(let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
    }
    
    let m, b;
    if (forceZeroIntercept) {
        m = sumX2 !== 0 ? sumXY / sumX2 : 0;
        b = 0;
    } else {
        let denominator = (n * sumX2 - sumX * sumX);
        if (denominator === 0) {
            m = 0;
            b = sumY / n;
        } else {
            m = (n * sumXY - sumX * sumY) / denominator;
            b = (sumY - m * sumX) / n;
        }
    }
    
    // Calculate R^2
    let ss_tot = 0, ss_res = 0;
    let meanY = sumY / n;
    for(let i = 0; i < n; i++) {
        let y_fit = m * x[i] + b;
        ss_res += Math.pow(y[i] - y_fit, 2);
        ss_tot += Math.pow(y[i] - meanY, 2);
    }
    let r2 = ss_tot !== 0 ? 1 - (ss_res / ss_tot) : 0;
    
    // Fit line points
    let minX = 0; // Starts from origin slightly past max
    let maxX = Math.max(...x) * 1.05;
    
    let fitX = [minX, maxX];
    let fitY = [m * minX + b, m * maxX + b];
    
    return { slope: m, intercept: b, r2: r2, fitX: fitX, fitY: fitY };
}

// Plot Logic
function plotData() {
    if (!parsedWorkbook) return;

    const selectedTabs = Array.from(tabsList.querySelectorAll('input:checked')).map(cb => cb.value);
    
    if (selectedTabs.length === 0) {
        setStatus('Please select at least one tab to plot.', 'error');
        return;
    }

    const forceZeroIntercept = zeroInterceptToggle.checked;
    
    let plotData = [];
    
    // Pre-defined vibrant colors similar to tab10 in matplotlib
    const colors = [
        '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', 
        '#06b6d4', '#ec4899', '#f97316', '#64748b', '#14b8a6'
    ];

    let hasValidData = false;

    selectedTabs.forEach((tabName, idx) => {
        const worksheet = parsedWorkbook.Sheets[tabName];
        // Convert sheet to JSON, array of arrays to get cols 0, 1, 2
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) return; // Need at least header + 1 row

        // Assuming Col 0: Current, Col 1: P_out, Col 2: dT
        let rawData = [];
        
        for (let i = 1; i < rows.length; i++) {
            let row = rows[i];
            if (row.length >= 3) {
                let current = parseFloat(row[0]);
                let pout = parseFloat(row[1]);
                let dt = parseFloat(row[2]);
                
                if (!isNaN(current) && !isNaN(pout) && !isNaN(dt)) {
                    rawData.push({ current, pout, dt });
                }
            }
        }

        if (rawData.length === 0) return;
        hasValidData = true;

        const color = colors[idx % colors.length];

        // 1. Plot raw points (transparent)
        plotData.push({
            x: rawData.map(d => d.pout),
            y: rawData.map(d => d.dt),
            mode: 'markers',
            type: 'scatter',
            name: `${tabName} Raw Points`,
            marker: { color: color, opacity: 0.4, size: 6, symbol: 'x' },
            showlegend: true
        });

        // Group by Current to get means and stddevs
        const grouped = {};
        rawData.forEach(d => {
            if (!grouped[d.current]) grouped[d.current] = { pout: [], dt: [] };
            grouped[d.current].pout.push(d.pout);
            grouped[d.current].dt.push(d.dt);
        });

        let xData = [];
        let yData = [];
        let xErr = [];
        let yErr = [];

        Object.keys(grouped).forEach(c => {
            const group = grouped[c];
            const pMean = group.pout.reduce((a,b) => a+b, 0) / group.pout.length;
            const dtMean = group.dt.reduce((a,b) => a+b, 0) / group.dt.length;
            
            // Sample standard deviation
            let pStd = 0, dtStd = 0;
            if (group.pout.length > 1) {
                pStd = Math.sqrt(group.pout.reduce((sq, n) => sq + Math.pow(n - pMean, 2), 0) / (group.pout.length - 1));
                dtStd = Math.sqrt(group.dt.reduce((sq, n) => sq + Math.pow(n - dtMean, 2), 0) / (group.dt.length - 1));
            }

            xData.push(pMean);
            yData.push(dtMean);
            xErr.push(pStd);
            yErr.push(dtStd);
        });

        // 2. Plot Grouped means with Error Bars
        plotData.push({
            x: xData,
            y: yData,
            mode: 'markers',
            type: 'scatter',
            name: `${tabName} Mean ± SD`,
            error_x: { type: 'data', array: xErr, visible: true, color: color },
            error_y: { type: 'data', array: yErr, visible: true, color: color },
            marker: { color: color, size: 8, symbol: 'circle' }
        });

        // 3. Linear Regression Fit
        const fit = linearRegression(xData, yData, forceZeroIntercept);
        
        let eqStr = "";
        if (forceZeroIntercept) {
            eqStr = `y = ${fit.slope.toFixed(3)}x`;
        } else {
            const sign = fit.intercept >= 0 ? '+' : '-';
            eqStr = `y = ${fit.slope.toFixed(3)}x ${sign} ${Math.abs(fit.intercept).toFixed(3)}`;
        }

        const legendLabel = `${tabName} Fit<br>${eqStr}<br>Slope: ${fit.slope.toFixed(3)} mK/mW<br>R²: ${fit.r2.toFixed(4)}`;

        plotData.push({
            x: fit.fitX,
            y: fit.fitY,
            mode: 'lines',
            type: 'scatter',
            name: legendLabel,
            line: { color: color, dash: 'dash', width: 2 }
        });
    });

    if (!hasValidData) {
        setStatus('No valid numerical data found in selected tabs. Ensure columns 1-3 contain Current, P_out, dT.', 'error');
        return;
    }

    const layout = {
        title: { text: 'ΔT vs P_out', font: { color: '#f8fafc', size: 20 } },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#94a3b8' },
        xaxis: { 
            title: { text: 'Power Out (P_out) [mW]', font: { color: '#f8fafc' } },
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)',
            zerolinewidth: 1,
            tickfont: { color: '#94a3b8' }
        },
        yaxis: { 
            title: { text: 'Change in Temperature (ΔT) [mK]', font: { color: '#f8fafc' } },
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.3)',
            zerolinewidth: 1,
            tickfont: { color: '#94a3b8' }
        },
        legend: {
            font: { color: '#f8fafc' },
            bgcolor: 'rgba(15,23,42,0.8)',
            bordercolor: 'rgba(255,255,255,0.1)',
            borderwidth: 1
        },
        margin: { l: 70, r: 30, t: 70, b: 70 },
        hovermode: 'closest'
    };

    const config = {
        responsive: true,
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'comparison_plot',
            height: 700,
            width: 1000,
            scale: 2
        }
    };

    plotContainer.innerHTML = '';
    Plotly.newPlot(plotContainer, plotData, layout, config);
    setStatus('Plot updated.', 'success');
}
