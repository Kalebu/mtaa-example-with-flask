from functools import lru_cache

from mtaa import tanzania
from flask import Flask, jsonify, render_template, request


app = Flask(__name__)


@app.get('/')
def index():
    return render_template('index.html', tanzania=tanzania, list=list)


@app.get('/<region>')
def districts(region):
    region = tanzania.get(region)
    _districts = list(region.districts) if region else []
    return jsonify(_districts)


@app.get('/<region>/<district>')
def wards(region, district):
    district = tanzania.get(region).districts.get(district)
    wards = []
    if district:
        wards = list(district.wards)
        wards.remove('ward_post_code')
    return jsonify(wards)


@app.get('/<region>/<district>/<ward>')
def streets(region, district, ward):
    ward = tanzania.get(region).districts.get(district).wards.get(ward)
    streets = list(ward.streets) if ward else []
    return jsonify(streets)


@app.get('/<region>/<district>/<ward>/<street>')
def neighborhood(region, district, ward, street):
    neighborhoods = tanzania.get(region).districts.get(
        district).wards.get(ward).streets.get(street)
    return jsonify((neighborhoods))


@lru_cache(maxsize=1)
def location_search_index():
    locations = []

    def add_location(name, level, region, district='', ward='', street='', post_code=''):
        if not isinstance(name, str) or not name.strip():
            return
        locations.append({
            'name': name,
            'level': level,
            'region': region,
            'district': district,
            'ward': ward,
            'street': street,
            'post_code': str(post_code or '').strip(),
        })

    for region in tanzania:
        region_data = tanzania.get(region)
        add_location(region, 'Region', region, post_code=region_data.get('post_code'))
        for district in region_data.districts:
            district_data = region_data.districts.get(district)
            add_location(district, 'District', region, district, post_code=district_data.get('district_post_code'))
            for ward in district_data.wards:
                if ward == 'ward_post_code':
                    continue
                ward_data = district_data.wards.get(ward)
                post_code = ward_data.get('ward_post_code')
                add_location(ward, 'Ward', region, district, ward, post_code=post_code)
                for street in ward_data.streets:
                    add_location(street, 'Street', region, district, ward, street, post_code)
                    for place in ward_data.streets.get(street):
                        add_location(place, 'Place', region, district, ward, street, post_code)

    return locations


@app.get('/api/search')
def search_locations():
    query = request.args.get('q', '').strip().casefold()
    level = request.args.get('level', '')
    if len(query) < 2 and level not in ('Region', 'District', 'Ward', 'Street', 'Place'):
        return jsonify([])

    matches = [
        location for location in location_search_index()
        if (not level or location['level'] == level)
        and (query in location['name'].casefold() or location['post_code'].startswith(query))
    ]
    matches.sort(key=lambda location: (
        not location['name'].casefold().startswith(query),
        len(location['name']),
        location['name'].casefold(),
    ))
    try:
        offset = max(0, int(request.args.get('offset', 0)))
        limit = min(100, max(1, int(request.args.get('limit', 8))))
    except ValueError:
        return jsonify({'error': 'Invalid pagination.'}), 400
    return jsonify(matches[offset:offset + limit])


def location_key(location):
    depth = ['Region', 'District', 'Ward', 'Street', 'Place'].index(location['level'])
    parts = [location[key] for key in ['region', 'district', 'ward', 'street']][:depth]
    return '/'.join(parts + [location['name']])


@lru_cache(maxsize=1)
def location_lookup():
    return {location_key(location): location for location in location_search_index()}


@lru_cache(maxsize=1)
def location_tree():
    return tanzania.tree()


@app.get('/api/details')
def location_details():
    location = location_lookup().get(request.args.get('path', ''))
    return (jsonify(location), 200) if location else (jsonify({'error': 'Location not found.'}), 404)


@app.get('/api/tree')
def export_tree():
    if request.args.get('path', '') not in location_lookup():
        return jsonify({'error': 'Location not found.'}), 404
    parts = request.args.get('path', '').split('/')
    node = location_tree()
    for index, part in enumerate(parts):
        if index > 0:
            key = ['districts', 'wards', 'streets'][index - 1] if index < 4 else None
            if key:
                node = node.get(key, {}) if isinstance(node, dict) else {}
        if isinstance(node, dict):
            node = node.get(part)
        elif isinstance(node, list) and part in node:
            node = [part]
        else:
            node = None
        if node is None:
            return jsonify({'error': 'Location not found.'}), 404
    response = jsonify(node)
    response.headers['Content-Disposition'] = 'attachment; filename="mtaa-location-tree.json"'
    return response


@app.get('/api/grouped')
def grouped_locations():
    level = request.args.get('level', '')
    response = jsonify([location for location in location_search_index()
                        if not level or location['level'] == level])
    response.headers['Content-Disposition'] = 'attachment; filename="mtaa-directory.json"'
    return response


if __name__ == '__main__':
    app.run(debug=True)
