import json
import subprocess
import unittest
from urllib.parse import urlencode
import mtaa

from app import app


class DirectoryTests(unittest.TestCase):
    def test_netlify_and_flask_match_for_documented_capabilities(self):
        cases = [
            ('/api/search', {'q': '53515', 'level': 'Ward'}),
            ('/api/search', {'q': '', 'level': 'District', 'offset': '8', 'limit': '9'}),
            ('/api/details', {'path': 'Mbeya/Rungwe/Kiwira'}),
            ('/api/details', {'path': "Kilimanjaro/Hai/Bomang'ombe/Mtakuja/Gezaulole"}),
            ('/api/details', {'path': 'Dar-es-salaam/Ubungo/Mbezi/Mbezi luis'}),
            ('/api/details', {'path': 'Kilimanjaro'}),
            ('/api/details', {'path': 'Kilimanjaro/Hai'}),
            ('/api/tree', {'path': 'Mbeya/Rungwe/Kiwira'}),
            ('/api/tree', {'path': "Kilimanjaro/Hai/Bomang'ombe/Mtakuja"}),
            ('/api/tree', {'path': 'not-a-region'}),
            ('/api/grouped', {'level': 'District'}),
            ('/api/grouped', {'level': 'Ward'}),
            ('/api/grouped', {'level': 'Street'}),
        ]
        events = [{'httpMethod': 'GET', 'path': '/.netlify/functions/locations',
                   'rawUrl': 'https://example.netlify.app' + path + '?' + urlencode(params),
                   'queryStringParameters': params} for path, params in cases]
        script = "const {handler}=require('./netlify/functions/locations.js'); Promise.all(JSON.parse(process.argv[1]).map(handler)).then(r=>process.stdout.write(JSON.stringify(r)))"
        results = json.loads(subprocess.check_output(['node', '-e', script, json.dumps(events)], text=True))
        with app.test_client() as client:
            for (path, params), result in zip(cases, results):
                with self.subTest(path=path, params=params):
                    response = client.get(path, query_string=params)
                    self.assertEqual(response.status_code, result['statusCode'])
                    self.assertEqual(response.json, json.loads(result['body']))
            ward = client.get('/api/details', query_string={'path': 'Mbeya/Rungwe/Kiwira'}).json
            self.assertEqual(ward['post_code'], '53515')
            search = client.get('/api/search', query_string={'q': '53515', 'level': 'Ward'}).json
            self.assertTrue(any(location['name'] == 'Kiwira' for location in search))
            street_count = sum(bool(name.strip()) for name in mtaa.streets)
            for level, count in [('District', 158), ('Ward', 3964), ('Street', street_count)]:
                rows = client.get('/api/grouped', query_string={'level': level}).json
                self.assertEqual(len(rows), count)
            tree = client.get('/api/tree', query_string={'path': 'Mbeya/Rungwe/Kiwira'}).json
            self.assertEqual(tree['ward_post_code'], '53515')
            self.assertIn('Mpandapanda', tree['streets'])


if __name__ == '__main__':
    unittest.main()
