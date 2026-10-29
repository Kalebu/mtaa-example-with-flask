# mtaa-example-with-flask

A minimal flask application showing you how you can use mtaa in your web application.

<img src = "mtaa_example_with_flask.png" height="350" width="600"></img>

The interface searches and browses locations without refreshing the page. Search by name or postcode, filter by location type, and move through result pages. Selecting a result opens its hierarchy, address summary, and available postcode. Empty dropdowns are hidden.

Region and district codes are postal prefixes. Streets and places use their ward's postcode. Records come from mtaa 1.5 (2021), and may be incomplete or outdated.

Download a selected location's nested tree with **Download area JSON**, or a complete grouped list with **Download directory JSON**. The type filter controls which group is exported.

## Netlify deployment

The committed `netlify.toml` builds with `python build_netlify.py`, publishes `dist`, and deploys the API from `netlify/functions`. Python dependencies are installed from `requirements.txt`. Flask remains available for local development; the Netlify API uses the same exported data.

To build and check both runtimes locally:

```bash
pip install -r requirements.txt
python build_netlify.py
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.js
```

## Getting started

You need to clone the repository or download manually

```bash
git clone https://github.com/Kalebu/mtaa-example-with-flask
cd mtaa-example-with-flask
mtaa-example-with-flask -> python app.py
```

Assuming you already have installed flask on your machine, the app should be running at localhost:5000

## Issues

Facing any issue while running it, raise one and looking forward to fixing it as soon as I can

## Contribute ?

Wanna add something whether a typo, docs or code, just fork it 

## Credits

All the Credits to [kalebu](https://github.com/Kalebu)
