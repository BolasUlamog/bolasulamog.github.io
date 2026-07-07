import json, urllib.request, re

def load_data(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = resp.read().decode('utf-8')
        return json.loads(data[data.find('{'):data.rfind('}')+1])

d2024 = json.loads(open('tmp2024.txt').read()[open('tmp2024.txt').read().find('{'):open('tmp2024.txt').read().rfind('}')+1])
rows = d2024['table']['rows']

games = []
hsIndex = 0
HS_LABELS_2024 = [
    'GIRLS JV', 'GIRLS JV', 'GIRLS JV', 'GIRLS JV',
    'BOYS JV', 'BOYS JV', 'BOYS JV', 'BOYS JV',
    'GIRLS VARSITY', 'GIRLS VARSITY', 'GIRLS VARSITY', 'GIRLS VARSITY',
    'BOYS VARSITY', 'BOYS VARSITY', 'BOYS VARSITY', 'BOYS VARSITY',
]

for r_obj in rows:
    c = r_obj.get('c', [])
    r = [cell['v'] if cell and 'v' in cell else None for cell in c]
    # pad to 15
    while len(r) < 15: r.append(None)
    
    rawAge = r[0]
    div = r[1]
    pos = r[2]
    count = r[3]
    
    age = None
    type_ = None
    league = None
    
    if isinstance(rawAge, (int, float)):
        age = 'U' + str(rawAge)
        type_ = 'youth'
    elif isinstance(rawAge, str) and rawAge.strip() != '':
        age = rawAge.title()
        type_ = 'hs'
    elif rawAge is None or rawAge == '':
        hsLabel = HS_LABELS_2024[hsIndex] if hsIndex < len(HS_LABELS_2024) else 'Unknown'
        hsIndex += 1
        age = hsLabel.title()
        type_ = 'hs'
    else:
        continue
        
    if count is None or count == 0 or not isinstance(count, (int, float)):
        continue
    if isinstance(pos, str) and 'total' in pos.lower():
        continue
        
    l1 = str(r[5]).strip() if r[5] else ''
    l2 = str(r[8]).strip() if r[8] else ''
    league = l1 or l2 or '—'
    if l1 and l2: league = l1 + ' / ' + l2
        
    games.append({'year': 2024, 'age': age, 'type': type_, 'pos': pos, 'count': count, 'league': league})

for g in games:
    if g['type'] == 'hs':
        print(g)
print("Total HS games in 2024:", sum(g['count'] for g in games if g['type'] == 'hs'))
