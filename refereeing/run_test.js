
global.querySheetJSONP = async function(sheet) {
    let data;
    if (sheet === 'Games (general)') data = fs.readFileSync('tmp.txt', 'utf8');
    else if (sheet === 'GAMES 2024') data = fs.readFileSync('tmp2024.txt', 'utf8');
    else if (sheet === 'GAMES 2023') data = fs.readFileSync('tmp2023.txt', 'utf8');
    else return [];

    if(!data) return [];
    data = data.substring(data.indexOf('{'), data.lastIndexOf('}')+1);
    let parsed = JSON.parse(data);
    return parsed.table.rows.map(r => r.c.map(cell => (cell && cell.v !== undefined) ? cell.v : null));
};

        const SHEET_ID = '1ZZ1GFMtNO54HkKsMYHBoVyuHheUIWSkSrGsWRol9fD4';

        const HS_LABELS_2023 = ['GIRLS JV', 'BOYS JV', 'GIRLS VARSITY', 'BOYS VARSITY', 'Alum'];
        const HS_LABELS_2024 = [
            'GIRLS JV', 'GIRLS JV', 'GIRLS JV', 'GIRLS JV',
            'BOYS JV', 'BOYS JV', 'BOYS JV', 'BOYS JV',
            'GIRLS VARSITY', 'GIRLS VARSITY', 'GIRLS VARSITY', 'GIRLS VARSITY',
            'BOYS VARSITY', 'BOYS VARSITY', 'BOYS VARSITY', 'BOYS VARSITY',
        ];

        // Load via classic JSONP endpoint directly, bypassing the Google JS loader entirely
        function querySheetJSONP(sheetName) {
            return new Promise((resolve, reject) => {
                const callbackName = 'callback_' + Math.random().toString(36).substr(2, 9);
                const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=responseHandler:${callbackName}`;
                
                const script = document.createElement('script');
                script.src = url;

                global[callbackName] = function(response) {
                    cleanup();
                    if (response.status === 'error') {
                        reject(new Error(response.errors[0].detailed_message));
                        return;
                    }
                    
                    const cols = response.table.cols;
                    const rows = response.table.rows.map(r => {
                        return r.c.map(cell => (cell && cell.v !== undefined) ? cell.v : null);
                    });
                    resolve(rows);
                };

                script.onerror = function() {
                    cleanup();
                    reject(new Error('Network error or blocked script'));
                };

                function cleanup() {
                    document.body.removeChild(script);
                    delete global[callbackName];
                }

                document.body.appendChild(script);
            });
        }

        // === PARSERS ===
        function divLabel(d) {
            if (d === 1) return 'Comp';
            if (d === 4) return 'Rec';
            return d != null ? String(d) : '—';
        }

        function titleCase(s) {
            if (!s) return '';
            return s.split(' ').map(w => {
                const up = w.toUpperCase();
                if (up === 'JV' || up === 'VARSITY') return up === 'JV' ? 'JV' : 'Varsity';
                if (up === 'AR') return 'AR';
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            }).join(' ');
        }

        function parseGames2022(rows) {
            const games = [];
            for (const r of rows) {
                const age = r[0], pos = r[1], count = r[2], league = r[3];
                if (typeof age !== 'number' || typeof count !== 'number' || count === 0) continue;
                games.push({ year: 2022, age: 'U' + age, div: 'Rec', pos: String(pos), games: count, league: String(league || ''), type: 'youth' });
            }
            return games;
        }

        function parseGamesSheet(rows, year) {
            const games = [];
            let hsIndex = 0;
            for (const r of rows) {
                const rawAge = r[0];
                const div = r[1];
                const pos = r[2];
                const count = r[3];

                // Determine age label and type first to keep the sequential index aligned
                let age, type, league;
                if (typeof rawAge === 'number') {
                    age = 'U' + rawAge;
                    type = 'youth';
                } else if (typeof rawAge === 'string' && rawAge.trim() !== '') {
                    age = titleCase(rawAge);
                    type = 'hs';
                } else if (rawAge == null || rawAge === '') {
                    // Fallback to HS labels when age column is null/empty
                    const labels = year === 2023 ? HS_LABELS_2023 : HS_LABELS_2024;
                    const hsLabel = labels[hsIndex] || 'Unknown';
                    hsIndex++;
                    
                    age = titleCase(hsLabel);
                    type = 'hs';
                } else {
                    continue; 
                }

                // Now check counts and skip if zero or invalid
                if (count == null || count === 0 || typeof count !== 'number') continue;
                if (typeof pos === 'string' && pos.toLowerCase().includes('total')) continue;

                if (year === 2023) {
                    league = r[4] ? String(r[4]).trim().replace(/\.\s*$/, '') : '—';
                } else {
                    const l1 = r[5] ? String(r[5]).trim() : '';
                    const l2 = r[8] ? String(r[8]).trim() : '';
                    league = l1 || l2 || '—';
                    if (l1 && l2) league = l1 + ' / ' + l2;
                }

                games.push({
                    year, age, div: type === 'hs' ? '—' : divLabel(div),
                    pos: titleCase(String(pos)),
                    games: count, league, type
                });
            }
            return games;
        }

        function parseGeneral(rows) {
            const summary = { totalGames: 0, byYear: {}, byAge: {}, byPosition: {}, cardColors: {} };
            
            const cardColorLabels = ['Yellow', 'Red', 'Blue', 'Green', 'Black', 'Pink'];
            let cardIndex = 0;

            for (const r of rows) {
                if (typeof r[0] === 'string' && r[0].includes('Games (#)')) {
                    summary.totalGames = r[1] || 0;
                }
                const parsedYear = r[0] != null ? parseInt(r[0]) : null;
                if (parsedYear != null && !isNaN(parsedYear) && parsedYear >= 2020 && parsedYear <= 2030 && typeof r[1] === 'number') {
                    summary.byYear[parsedYear] = r[1];
                }
                if (r[3] != null && r[4] != null && typeof r[4] === 'number' && r[3] !== 'Age Group') {
                    const label = typeof r[3] === 'number' ? String(r[3]) : String(r[3]).replace(/"/g, '');
                    summary.byAge[label] = r[4];
                }
                if (r[6] != null && r[7] != null && typeof r[7] === 'number' && r[6] !== 'Position') {
                    summary.byPosition[r[6]] = r[7];
                }
                // Only start parsing jersey colors when we reach the years rows (where r[0] is 2022/2023/2024 or null for the rows below them)
                const isYearRowOrBelow = (r[0] === 2022 || r[0] === 2023 || r[0] === 2024 || r[0] === '2022' || r[0] === '2023' || r[0] === '2024' || r[0] === null || r[0] === undefined);
                const hasValueInCol10 = r[10] != null && typeof r[10] === 'number';
                
                // Exclude the pay headers / totals in the first few rows by verifying we are in the years block
                if (isYearRowOrBelow && hasValueInCol10 && cardIndex < cardColorLabels.length && !r[0]?.toString().includes('Games')) {
                    // Skip the first row containing pay amount (2158) if it gets here
                    if (r[10] > 1000) continue;
                    
                    summary.cardColors[cardColorLabels[cardIndex]] = r[10];
                    cardIndex++;
                }
            }
            return summary;
        }

        // === STATE ===
        let allGames = [];
        let summary = {};
        let currentYear = 'all';
        let currentFilter = 'all';

        // Preloaded 2025 games from games.csv (so they show up immediately before they are filled in the sheet)
        const local2025Games = [
            { year: 2025, age: 'U14', div: 'Comp', pos: 'AR', games: 1, league: 'RPSC', type: 'youth' },
            { year: 2025, age: 'U16', div: 'Comp', pos: 'AR', games: 1, league: 'RPSC', type: 'youth' },
            { year: 2025, age: 'U16', div: 'Comp', pos: 'AR', games: 1, league: 'RPSC', type: 'youth' },
            { year: 2025, age: 'U15', div: 'Comp', pos: 'AR', games: 1, league: 'RPSC', type: 'youth' },
            { year: 2025, age: 'U17', div: 'Comp', pos: 'AR', games: 1, league: 'RPSC', type: 'youth' }, // Scrimmage U17
            { year: 2025, age: 'U10', div: 'Rec', pos: 'Center (3)', games: 1, league: 'WYSL', type: 'youth' },
            { year: 2025, age: 'U10', div: 'Rec', pos: 'Center (3)', games: 1, league: 'WYSL', type: 'youth' }, // Cancelled but paid
            { year: 2025, age: 'U17', div: 'Comp', pos: 'AR', games: 1, league: 'RPSC', type: 'youth' }
        ];

        // === PARSERS ===
        function parseGames2025Sheet(rows) {
            const games = [];
            for (const r of rows) {
                const rawAge = r[0];
                const div = r[1];
                const pos = r[2];
                if (rawAge == null || pos == null) continue;
                if (typeof pos === 'string' && pos.toLowerCase().includes('total')) continue;

                let age = typeof rawAge === 'number' ? 'U' + rawAge : titleCase(String(rawAge));
                let type = (typeof rawAge === 'number') ? 'youth' : 'hs';

                // Loop through League #1, #2, #3 columns
                const leagues = [
                    { name: r[3], count: r[4] },
                    { name: r[5], count: r[6] },
                    { name: r[7], count: r[8] }
                ];

                for (const league of leagues) {
                    if (league.name && typeof league.count === 'number' && league.count > 0) {
                        games.push({
                            year: 2025,
                            age,
                            div: type === 'hs' ? '—' : divLabel(div),
                            pos: titleCase(String(pos)),
                            games: league.count,
                            league: String(league.name).trim().replace(/\.\s*$/, ''),
                            type
                        });
                    }
                }
            }
            return games;
        }

        // === RENDERING ===
        function posCategory(pos) {
            const p = pos.toLowerCase();
            if (p.includes('solo') || (p.includes('center') && p.includes('1'))) return 'solo';
            if (p.includes('center')) return 'center';
            if (p.includes('ar')) return 'ar';
            if (p.includes('dual')) return 'dual';
            return 'other';
        }

        function posBadgeClass(pos) {
            const c = posCategory(pos);
            return c === 'ar' ? 'badge-blue' : c === 'center' ? 'badge-yellow'
                : c === 'dual' ? 'badge-purple' : c === 'solo' ? 'badge-orange' : 'badge-neutral';
        }

        function leagueBadgeClass(league) {
            const l = league.toLowerCase();
            return l.includes('rpsc') ? 'badge-green' : l.includes('windsor') || l.includes('wind') || l.includes('wysl') ? 'badge-orange'
                : l.includes('nbsra') ? 'badge-blue' : l.includes('wesco') ? 'badge-purple' : 'badge-neutral';
        }

        function getFiltered() {
            return allGames.filter(g => {
                if (currentYear !== 'all' && g.year !== parseInt(currentYear)) return false;
                if (currentFilter === 'youth') return g.type === 'youth';
                if (currentFilter === 'hs') return g.type === 'hs';
                return true;
            });
        }

        function renderTable() {
            const tableBody = ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } });
            const filtered = getFiltered();
            if (filtered.length === 0) {
                tableBody.innerHTML = '<div class="empty-state">No games match these filters</div>';
                return;
            }
            tableBody.innerHTML = `<table><thead><tr>
                <th>Year</th><th>Age Group</th><th>Division</th><th>Position</th><th>Games</th><th>League</th>
                </tr></thead><tbody>${filtered.map(g => `<tr>
                    <td class="td-year">${g.year}</td>
                    <td><span class="age-label">${g.age}</span></td>
                    <td><span style="color:var(--text-secondary);font-size:0.82rem">${g.div}</span></td>
                    <td><span class="badge ${posBadgeClass(g.pos)}">${g.pos}</span></td>
                    <td><span class="game-count">${g.games}</span></td>
                    <td><span class="badge ${leagueBadgeClass(g.league)}">${g.league}</span></td>
                </tr>`).join('')}</tbody></table>`;
            const card = ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } });
            card.classList.remove('table-fade');
            void card.offsetWidth;
            card.classList.add('table-fade');
        }

        function renderYearTabs() {
            const years = [...new Set(allGames.map(g => g.year))].sort((a, b) => b - a);
            const container = ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } });
            container.innerHTML = `<button class="tab-btn active" data-year="all">All Time</button>`
                + years.map(y => `<button class="tab-btn" data-year="${y}">${y}</button>`).join('');
            container.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentYear = btn.dataset.year;
                    renderTable(); renderCharts(); updateStats();
                });
            });
        }

        function renderCharts() {
            const filtered = getFiltered();
            const barColors = ['bar-fill-blue', 'bar-fill-green', 'bar-fill-yellow', 'bar-fill-purple', 'bar-fill-orange', 'bar-fill-red'];

            let posMap = { 'AR': 0, 'Center (3)': 0, 'Dual': 0, 'Center (1)': 0 };
            
            const ageOrder = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '19', 'JV', 'Varsity', 'Other'];
            let ageMap = {};
            ageOrder.forEach(age => ageMap[age] = 0);

            filtered.forEach(g => {
                const pl = posCategory(g.pos) === 'ar' ? 'AR' :
                    posCategory(g.pos) === 'center' ? 'Center (3)' :
                    posCategory(g.pos) === 'dual' ? 'Dual' : 'Center (1)';
                posMap[pl] = (posMap[pl] || 0) + g.games;
                
                let al = g.age ? String(g.age).replace(/^U/, '') : '';
                if (al.includes('JV')) al = 'JV';
                else if (al.includes('Varsity')) al = 'Varsity';
                else if (al.toLowerCase().includes('alum') || al.toLowerCase().includes('other')) al = 'Other';
                
                if (ageMap[al] !== undefined) {
                    ageMap[al] += g.games;
                } else {
                    ageMap[al] = g.games;
                }
            });

            const posChart = ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } });
            const maxPos = Math.max(...Object.values(posMap), 1);
            posChart.innerHTML = Object.entries(posMap).sort((a, b) => b[1] - a[1])
                .map(([l, c], i) => `<div class="bar-row"><span class="bar-label">${l}</span>
                    <div class="bar-track"><div class="bar-fill ${barColors[i % barColors.length]}" data-width="${c / maxPos * 100}"></div></div>
                    <span class="bar-value">${c}</span></div>`).join('');

            const ageChart = ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } });
            const maxAge = Math.max(...Object.values(ageMap), 1);
            
            ageChart.innerHTML = ageOrder
                .map(l => ({ label: l, count: ageMap[l] || 0 }))
                .filter(item => item.count > 0 || item.label === '17' || item.label === '19')
                .map((item, i) => `<div class="bar-row"><span class="bar-label">${item.label}</span>
                    <div class="bar-track"><div class="bar-fill ${barColors[i % barColors.length]}" data-width="${item.count / maxAge * 100}"></div></div>
                    <span class="bar-value">${item.count}</span></div>`).join('');

            setImmediate(() => {
                ({ forEach: ()=>{} }).forEach(bar => {
                    setTimeout(() => { bar.style.width = bar.dataset.width + '%'; }, 50);
                });
                ({ forEach: ()=>{} }).forEach(bar => {
                    setTimeout(() => { bar.style.width = bar.dataset.width + '%'; }, 50);
                });
            });
        }

        function renderYearCards() {
            const container = ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } });
            const years = Object.entries(summary.byYear || {}).sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
            const max = Math.max(...years.map(([, v]) => v), 1);
            container.innerHTML = years.map(([y, c]) => `<div class="year-card">
                <span class="year-card-label">${y}</span>
                <div class="year-card-bar"><div class="year-card-bar-fill" data-width="${c / max * 100}"></div></div>
                <span class="year-card-value">${c}</span></div>`).join('');
        }

        // Setup cards count
        function renderColorGrid() {
            const container = ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } });
            const colorMap = { Yellow: '#facc15', Red: '#ef4444', Blue: '#3b82f6', Green: '#22c55e', Black: '#171717', Pink: '#f472b6' };
            const colors = summary.cardColors || {};
            container.innerHTML = Object.entries(colorMap).map(([name, bg]) => `<div class="color-item">
                <div class="color-dot" style="background:${bg}"></div>
                <span class="color-item-count">${colors[name] ?? '—'}</span>
                <span class="color-item-label">${name}</span></div>`).join('');
        }

        function updateStats() {
            const filtered = getFiltered();
            const total = currentYear === 'all' && currentFilter === 'all'
                ? (summary.totalGames || filtered.reduce((s, g) => s + g.games, 0))
                : filtered.reduce((s, g) => s + g.games, 0);
            const seasons = [...new Set(filtered.map(g => g.year))].sort();
            const leagues = [...new Set(filtered.flatMap(g => g.league.split('/').map(l => l.trim())).filter(l => l !== '—'))];
            const ages = new Set(filtered.map(g => g.age));

            animateCounter(({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }), total);
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = seasons.length ? `${seasons[0]} – ${seasons[seasons.length - 1]}` : '';
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = seasons.length;
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = seasons.join(', ');
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = leagues.length;
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = leagues.join(' · ');
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = ages.size;
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = ages.size + ' groups';
            ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).textContent = total + ' games';
        }

        function animateCounter(el, target) {
            const start = parseInt(el.textContent) || 0;
            if (isNaN(target)) { el.textContent = target; return; }
            const duration = 600, startTime = performance.now();
            function tick(now) {
                const p = Math.min((now - startTime) / duration, 1);
                el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
                if (p < 1) setImmediate(tick);
            }
            setImmediate(tick);
        }

        ({ forEach: ()=>{} }).forEach(pill => {
            pill.addEventListener('click', () => {
                ({ forEach: ()=>{} }).forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentFilter = pill.dataset.filter;
                renderTable(); renderCharts(); updateStats();
            });
        });

        // === INIT ===
        async function init() {
            try {
                const [generalRows, rows2022, rows2023, rows2024, rows2025] = await Promise.all([
                    querySheetJSONP('Games (general)'),
                    querySheetJSONP('GAMES 2022'),
                    querySheetJSONP('GAMES 2023'),
                    querySheetJSONP('GAMES 2024'),
                    querySheetJSONP('GAMES 2025').catch(err => {
                        console.warn('GAMES 2025 tab not available yet in Google Sheets, using local fallback.', err);
                        return [];
                    })
                ]);

                summary = parseGeneral(generalRows);
                
                const games2025 = rows2025 && rows2025.length > 0 ? parseGames2025Sheet(rows2025) : [];
                const final2025 = games2025.length > 0 ? games2025 : local2025Games;

                allGames = [
                    ...parseGames2022(rows2022),
                    ...parseGamesSheet(rows2023, 2023),
                    ...parseGamesSheet(rows2024, 2024),
                    ...final2025
                ];

                // Dynamically update the summary totals for 2025
                const total2025Games = final2025.reduce((sum, g) => sum + g.games, 0);
                summary.byYear['2025'] = total2025Games;
                summary.totalGames = (summary.totalGames || 0) + total2025Games;

                renderYearTabs();
                renderYearCards();
                renderColorGrid();
                renderTable();
                renderCharts();
                updateStats();
            } catch (err) {
                console.error('Failed to load:', err);
                ({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } }).innerHTML =
                    `<div class="empty-state">Failed to load data from Google Sheets.<br><small style="color:var(--red)">${err.message}</small></div>`;
            }
        }

        init();
    
async function runTest() {
    try {
        const [generalRows, rows2022, rows2023, rows2024, rows2025] = await Promise.all([
            global.querySheetJSONP('Games (general)'),
            global.querySheetJSONP('GAMES 2022'),
            global.querySheetJSONP('GAMES 2023'),
            global.querySheetJSONP('GAMES 2024'),
            global.querySheetJSONP('GAMES 2025')
        ]);
        
        summary = parseGeneral(generalRows);
        const games2025 = rows2025 && rows2025.length > 0 ? parseGames2025Sheet(rows2025) : [];
        const final2025 = games2025.length > 0 ? games2025 : local2025Games;
        allGames = [
            ...parseGames2022(rows2022),
            ...parseGamesSheet(rows2023, 2023),
            ...parseGamesSheet(rows2024, 2024),
            ...final2025
        ];
        
        const total2025Games = final2025.reduce((sum, g) => sum + g.games, 0);
        summary.byYear['2025'] = total2025Games;
        summary.totalGames = (summary.totalGames || 0) + total2025Games;
        
        console.log("summary.totalGames =", summary.totalGames);
        console.log("allGames length =", allGames.length);
        console.log("summary.byYear =", summary.byYear);
        const leagues = [...new Set(allGames.flatMap(g => g.league.split('/').map(l => l.trim())).filter(l => l !== '—'))];
        console.log("leagues =", leagues);
        const hsGames = allGames.filter(g => g.type === 'hs');
        console.log("HS Games length =", hsGames.length);
        if(hsGames.length > 0) console.log("Sample HS game:", hsGames[0]);
    } catch(e) {
        console.error(e);
    }
}
runTest();
