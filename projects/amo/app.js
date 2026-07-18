// Global State
let parsedWorkbook = null;

// Tab Switching Logic
document.querySelectorAll('#tab-nav a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Update active nav link
        document.querySelectorAll('#tab-nav a').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        // Show corresponding content pane
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        const targetId = this.getAttribute('href').substring(1);
        document.getElementById(targetId).classList.add('active');
    });
});

// Initialize and Fetch Local Data
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data/amo_data.xlsx');
        if (!response.ok) {
            throw new Error(`Failed to fetch`);
        }
        const arrayBuffer = await response.arrayBuffer();
        loadWorkbookFromArrayBuffer(arrayBuffer);
    } catch (err) {
        // If fetch fails (e.g. CORS on file:///), show the manual upload fallback
        console.warn('Fetch failed, likely due to local file restrictions. Showing upload fallback.');
        document.getElementById('fallback-upload').style.display = 'block';
    }
});

// Manual File Upload Handler
document.getElementById('local-file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        loadWorkbookFromArrayBuffer(e.target.result);
        document.getElementById('fallback-upload').style.display = 'none';
    };
    reader.readAsArrayBuffer(file);
});

function loadWorkbookFromArrayBuffer(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    parsedWorkbook = workbook;
    parsedWorkbook.expandedTabs = [];
    
    // Parse Photodetector Tabs Dynamically
    workbook.SheetNames.forEach((name) => {
        const worksheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rows.length > 0) {
            const headers = rows[0].map(h => String(h || '').trim());
            let foundPhotodetector = false;
            headers.forEach((h, colIdx) => {
                if (h.includes('P_1') || h.includes('P_2')) {
                    if (colIdx > 0 && headers[colIdx - 1].includes('Current')) {
                        parsedWorkbook.expandedTabs.push({ 
                            name: `${name} - ${h}`, 
                            originalTab: name, 
                            type: 'Photodetector',
                            curCol: colIdx - 1,
                            pCol: colIdx
                        });
                        foundPhotodetector = true;
                    }
                }
            });
            if (foundPhotodetector) return;
        }
        parsedWorkbook.expandedTabs.push({ name: name, originalTab: name, type: 'standard' });
    });

    // Render the specific pre-configured graphs!
    
    // 7/9
    renderComparisonGraph('graph-79-final', ['MS30A1 splice before', 'SG1864L']);

    // 7/15 Graphs
    renderComparisonGraph('graph-715-sg-scatter', ['SG1744L', 'SG1744L test #2']);
    renderComparisonGraph('graph-715-sg-bar', ['SG1744L', 'SG1744L test #2'], { isBarChart: true });
    renderComparisonGraph('graph-715-ms-scatter', ['MS30A1 splice before', 'MS30A1 test #2']);
    renderComparisonGraph('graph-715-ms-bar', ['MS30A1 splice before', 'MS30A1 test #2'], { isBarChart: true });
    
    // 7/17 Graphs (Normalized)
    renderComparisonGraph('graph-717-norm1', ['MS30A1 splice before', 'MS30A1 test #2 normalized']);
    renderComparisonGraph('graph-717-norm2', ['MS30A1 splice before', 'Copy of MS30A1 test #2 normaliz']);
    renderComparisonGraph('graph-717-norm3', ['SG1744L', 'SG1744L test #2 normalized']);
}

// Linear Regression Engine
function linearRegression(x, y, forceZeroIntercept = false) {
    let n = x.length;
    if (n === 0) return { slope: 0, intercept: 0, r2: 0, fitX: [], fitY: [] };

    let m = 0, b = 0;
    
    if (forceZeroIntercept) {
        let sumXY = 0, sumX2 = 0;
        for(let i=0; i<n; i++) {
            sumXY += x[i]*y[i];
            sumX2 += x[i]*x[i];
        }
        m = sumX2 === 0 ? 0 : sumXY / sumX2;
        b = 0;
        
        let sumY = 0;
        for(let i=0; i<n; i++) sumY += y[i];
        let meanY = sumY / n;
        
        let ss_tot = 0, ss_res = 0;
        for(let i=0; i<n; i++) {
            ss_res += Math.pow(y[i] - (m * x[i]), 2);
            ss_tot += Math.pow(y[i] - meanY, 2);
        }
        let r2 = ss_tot !== 0 ? 1 - (ss_res / ss_tot) : 0;
        
        let minX = 0;
        let maxX = Math.max(...x) * 1.05;
        return { slope: m, intercept: b, r2: r2, fitX: [minX, maxX], fitY: [0, m * maxX] };
    } else {
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for(let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
        }
        
        let denominator = (n * sumX2 - sumX * sumX);
        if (denominator === 0) {
            b = sumY / n;
        } else {
            m = (n * sumXY - sumX * sumY) / denominator;
            b = (sumY - m * sumX) / n;
        }
        
        let ss_tot = 0, ss_res = 0;
        let meanY = sumY / n;
        for(let i = 0; i < n; i++) {
            let y_fit = m * x[i] + b;
            ss_res += Math.pow(y[i] - y_fit, 2);
            ss_tot += Math.pow(y[i] - meanY, 2);
        }
        let r2 = ss_tot !== 0 ? 1 - (ss_res / ss_tot) : 0;
        
        let minX = 0;
        let maxX = Math.max(...x) * 1.05;
        return { slope: m, intercept: b, r2: r2, fitX: [minX, maxX], fitY: [m * minX + b, m * maxX + b] };
    }
}

// Custom Comparison Graph Renderer
function renderComparisonGraph(containerId, tabNames, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];
    let plotData = [];
    let isPhotodetectorPlot = false;
    let isBarChart = options.isBarChart || false;

    tabNames.forEach((tabName, idx) => {
        const tabObj = parsedWorkbook.expandedTabs.find(t => t.name === tabName);
        if (!tabObj) return;

        const worksheet = parsedWorkbook.Sheets[tabObj.originalTab];
        if (!worksheet) return;
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rows.length < 2) return;

        let rawData = [];
        if (tabObj.type === 'Photodetector') {
            isPhotodetectorPlot = true;
            const curCol = tabObj.curCol;
            const pCol = tabObj.pCol;
            for (let i = 1; i < rows.length; i++) {
                let row = rows[i];
                if (row.length > pCol) {
                    let current = parseFloat(row[curCol]);
                    let p = parseFloat(row[pCol]);
                    if (!isNaN(current) && !isNaN(p)) {
                        rawData.push({ groupKey: current, x: current, y: p });
                    }
                }
            }
        } else {
            // standard tab: Col 0 is current, Col 1 is P_out, Col 2 is dT
            for (let i = 1; i < rows.length; i++) {
                let row = rows[i];
                if (row.length >= 3) {
                    let current = parseFloat(row[0]);
                    let pout = parseFloat(row[1]);
                    let dt = parseFloat(row[2]);
                    
                    if (isBarChart) {
                        if (!isNaN(current) && !isNaN(dt)) {
                            rawData.push({ groupKey: current, x: current, y: dt });
                        }
                    } else {
                        if (!isNaN(current) && !isNaN(pout) && !isNaN(dt)) {
                            rawData.push({ groupKey: current, x: pout, y: dt });
                        }
                    }
                }
            }
        }

        if (rawData.length === 0) return;

        // Group by groupKey (Current)
        const groupedX = {};
        const groupedY = {};
        rawData.forEach(d => {
            if (!groupedX[d.groupKey]) {
                groupedX[d.groupKey] = [];
                groupedY[d.groupKey] = [];
            }
            groupedX[d.groupKey].push(d.x);
            groupedY[d.groupKey].push(d.y);
        });

        let xData = [];
        let yData = [];
        let yErr = [];

        Object.keys(groupedX).forEach(key => {
            const xGroup = groupedX[key];
            const yGroup = groupedY[key];
            const xMean = xGroup.reduce((a,b) => a+b, 0) / xGroup.length;
            const yMean = yGroup.reduce((a,b) => a+b, 0) / yGroup.length;
            
            let yStd = 0;
            if (yGroup.length > 1) {
                yStd = Math.sqrt(yGroup.reduce((sq, n) => sq + Math.pow(n - yMean, 2), 0) / (yGroup.length - 1));
            }
            xData.push(isBarChart ? parseFloat(key) : xMean);
            yData.push(yMean);
            yErr.push(yStd);
        });

        // Use forceZeroIntercept for standard delta T plots
        const forceZeroIntercept = (!isPhotodetectorPlot && !isBarChart);
        const fit = linearRegression(xData, yData, forceZeroIntercept);
        const color = colors[idx % colors.length];
        const slopeUnits = isPhotodetectorPlot ? 'mW/A' : 'mK/mW';

        if (isBarChart) {
            plotData.push({
                x: xData.map(String),
                y: yData,
                type: 'bar',
                name: `${tabName} Mean \u00B1 SD`,
                error_y: { type: 'data', array: yErr, visible: true, color: '#1e293b', thickness: 1.5 },
                marker: { color: color, line: {color: '#1e293b', width: 1} }
            });
        } else {
            plotData.push({
                x: rawData.map(d => d.x),
                y: rawData.map(d => d.y),
                mode: 'markers',
                type: 'scatter',
                name: `${tabName} Raw Points`,
                marker: { color: color, opacity: 0.3, size: 5, symbol: 'x' },
                showlegend: true
            });
            
            plotData.push({
                x: xData,
                y: yData,
                mode: 'markers',
                type: 'scatter',
                name: `${tabName} Mean \u00B1 SD`,
                error_y: { type: 'data', array: yErr, visible: true, color: color, thickness: 1.5 },
                marker: { color: color, size: 7, symbol: 'circle', line: {color: '#1e293b', width: 1} }
            });
            
            const eqStr = forceZeroIntercept ? `y = ${fit.slope.toFixed(3)}x` : `y = ${fit.slope.toFixed(3)}x ${fit.intercept >= 0 ? '+' : '-'} ${Math.abs(fit.intercept).toFixed(3)}`;
            
            plotData.push({
                x: fit.fitX,
                y: fit.fitY,
                mode: 'lines',
                type: 'scatter',
                name: `${tabName} Fit<br>  ${eqStr}<br>  Slope: ${fit.slope.toFixed(3)} ${slopeUnits}<br>  R\u00B2: ${fit.r2.toFixed(4)}`,
                line: { color: color, dash: 'dash', width: 2 }
            });
        }
    });

    if (plotData.length === 0) {
        container.innerHTML = '<p style="color: red;">Could not load data for this graph.</p>';
        return;
    }

    let xAxisTitle = 'Power Out (P_out) [mW]';
    let yAxisTitle = 'Change in Temperature (Delta T) [mK]';
    let plotTitle = 'Delta T vs P_out';

    if (isPhotodetectorPlot) {
        xAxisTitle = 'Current [A]';
        yAxisTitle = 'Power (P) [mW]';
        plotTitle = 'Power vs Current';
    } else if (isBarChart) {
        xAxisTitle = 'Current [A]';
        plotTitle = 'Delta T vs Current';
    }

    const layout = {
        title: { text: plotTitle, font: { color: '#1e293b', size: 18 } },
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        font: { family: '"Inter", sans-serif', color: '#1e293b', size: 12 },
        xaxis: { 
            title: { text: xAxisTitle, font: { size: 14 } },
            type: isBarChart ? 'category' : '-',
            showgrid: true, gridcolor: '#e2e8f0', griddash: 'dot', zeroline: false, showline: true, linecolor: '#1e293b', mirror: 'ticks', ticks: 'inside'
        },
        yaxis: { 
            title: { text: yAxisTitle, font: { size: 14 } },
            showgrid: true, gridcolor: '#e2e8f0', griddash: 'dot', zeroline: false, showline: true, linecolor: '#1e293b', mirror: 'ticks', ticks: 'inside'
        },
        legend: {
            font: { size: 11 },
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            bordercolor: '#e2e8f0',
            borderwidth: 1
        },
        margin: { l: 60, r: 30, t: 50, b: 50 },
        barmode: isBarChart ? 'group' : 'overlay'
    };

    Plotly.newPlot(containerId, plotData, layout, { responsive: true, displaylogo: false });
}
