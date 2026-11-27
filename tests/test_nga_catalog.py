"""Exercise the catalogue's image-rights boundary without museum network access."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('nga_catalog', Path(__file__).resolve().parents[1] / 'scripts/build-nga-catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)

class CatalogueRights(unittest.TestCase):
    def test_only_unrestricted_primary_images_and_artist_origins_are_exported(self):
        datasets = {
            'constituents': [{'constituentid': 'a', 'nationality': 'French'}, {'constituentid': 'o', 'nationality': 'American'}],
            'objects_constituents': [
                {'objectid': '1', 'constituentid': 'a', 'roletype': 'artist'},
                {'objectid': '1', 'constituentid': 'o', 'roletype': 'owner'}],
            'published_images': [], 'objects': []}
        for key, access, view, virtual in [('1', '1', 'primary', '0'), ('2', '0', 'primary', '0'),
                                            ('3', '1', 'alternate', '0'), ('4', '1', 'primary', '1')]:
            datasets['published_images'].append({'openaccess': access, 'viewtype': view, 'iiifurl': 'https://api.nga.gov/iiif/img-'+key,
                'depictstmsobjectid': key, 'sequence': '0', 'width': '2000', 'height': '1500'})
            datasets['objects'].append({'objectid': key, 'title': 'Work '+key, 'isvirtual': virtual, 'classification': 'Painting',
                'attribution': 'Artist', 'displaydate': '1880', 'beginyear': '1880', 'endyear': '1880', 'medium': 'Oil',
                'dimensions': '', 'creditline': ''})
        # An unrestricted alternate view must not rescue a restricted primary.
        datasets['published_images'].append({**datasets['published_images'][1], 'openaccess': '1', 'viewtype': 'alternate'})
        old_rows, old_out = catalog.rows, catalog.OUT
        try:
            catalog.rows = lambda name: iter(datasets[name])
            with tempfile.TemporaryDirectory() as tmp:
                catalog.OUT = Path(tmp)
                catalog.main()
                manifest = json.loads((catalog.OUT/'manifest.json').read_text(encoding='utf8'))
                self.assertEqual(manifest['total'], 1)
                rows = json.loads((catalog.OUT/manifest['shards'][0]['file']).read_text(encoding='utf8'))
                work = dict(zip(manifest['columns'], rows[0]))
                self.assertEqual(work['id'], '1')
                self.assertEqual(work['nationality'], 'French')
        finally:
            catalog.rows, catalog.OUT = old_rows, old_out

if __name__ == '__main__': unittest.main()
