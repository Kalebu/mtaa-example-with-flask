"""Render the UI and export mtaa records for Netlify's JavaScript runtime."""
import json
from pathlib import Path
from shutil import copytree

from app import app, index, location_search_index, location_tree, location_key


ROOT = Path(__file__).resolve().parent
output = ROOT / 'dist'
output.mkdir(exist_ok=True)
with app.test_request_context('/'):
    (output / 'index.html').write_text(index(), encoding='utf-8')
copytree(ROOT / 'static', output / 'static', dirs_exist_ok=True)

locations = location_search_index()
children = {}
for location in locations:
    depth = ['Region', 'District', 'Ward', 'Street', 'Place'].index(location['level'])
    parents = [location[key] for key in ['region', 'district', 'ward', 'street']][:depth]
    children.setdefault('/'.join(parents), []).append(location['name'])

data_dir = ROOT / 'netlify' / 'functions' / 'data'
data_dir.mkdir(parents=True, exist_ok=True)
(data_dir / 'locations.json').write_text(
    json.dumps({'locations': locations, 'children': children, 'tree': location_tree(),
                'lookup': {location_key(location): i for i, location in enumerate(locations)}},
               ensure_ascii=False, separators=(',', ':')),
    encoding='utf-8',
)
print(f'Built Netlify site with {len(locations):,} location records.')
