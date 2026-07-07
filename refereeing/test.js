const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// We can just extract the JS logic and run it!
let scriptContent = html.substring(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

// Let's replace the DOM interactions with mocks
scriptContent = scriptContent.replace(/document\.getElementById\((.*?)\)/g, '({ textContent: "", innerHTML: "", classList: { add: ()=>{}, remove: ()=>{} } })');
scriptContent = scriptContent.replace(/document\.querySelectorAll\((.*?)\)/g, '({ forEach: ()=>{} })');
scriptContent = scriptContent.replace(/requestAnimationFrame/g, 'setImmediate');
scriptContent = scriptContent.replace(/window\[/g, 'global[');

const mockJSONP = `
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
`;

const run = `
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
`;

fs.writeFileSync('run_test.js', mockJSONP + scriptContent + run);
