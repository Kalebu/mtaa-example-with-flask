import threading
from mtaa import tanzania
from flask import Flask, render_template, jsonify


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


if __name__ == '__main__':
    app.run(debug=True)
