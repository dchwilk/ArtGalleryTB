"""Build small, directly hosted shards from the NGA's official Open Access CSVs.

Run manually with Python 3: python scripts/build-nga-catalog.py
No API key or third-party image source is used. Only unrestricted primary images
are included. The gallery loads a few relevant shards, never the original CSVs.
"""
import csv
import hashlib
import io
import json
import re
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE = 'https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/'
OUT = Path(__file__).resolve().parents[1] / 'app' / 'data' / 'nga'
COLUMNS = ['id', 'title', 'artist_display', 'date_display', 'date_start', 'date_end',
           'classification_title', 'medium_display', 'dimensions', 'credit_line',
           'imageService', 'imageWidth', 'imageHeight', 'nationality']

def rows(name):
    with urllib.request.urlopen(BASE + name + '.csv', timeout=120) as response:
        yield from csv.DictReader(io.TextIOWrapper(response, encoding='utf-8-sig', newline=''))

def kind(label):
    for key, pattern in [('painting', 'painting'), ('photograph', 'photograph'),
                         ('print', 'print'), ('drawing', 'drawing'), ('sculpture', 'sculpture')]:
        if pattern in label.lower(): return key
    return 'decorative'

def year(value):
    try: return int(value)
    except (ValueError, TypeError): return None

def main():
    nationalities = {row['constituentid']: row['nationality'] for row in rows('constituents') if row['nationality']}
    artists = defaultdict(set)
    for relation in rows('objects_constituents'):
        if relation['roletype'] == 'artist' and relation['constituentid'] in nationalities:
            artists[relation['objectid']].add(nationalities[relation['constituentid']])
    images = {}
    for image in rows('published_images'):
        if image['openaccess'] != '1' or image['viewtype'].lower() != 'primary': continue
        service = image['iiifurl'].rstrip('/')
        if not re.fullmatch(r'https://api\.nga\.gov/iiif/[\w-]+', service): continue
        key = image['depictstmsobjectid']
        # Primary images can have multiple sequences; prefer the first view.
        if key not in images or int(image['sequence'] or 0) < int(images[key]['sequence'] or 0): images[key] = image
    groups = defaultdict(list)
    for work in rows('objects'):
        image = images.get(work['objectid'])
        if not image or not work['title'] or work['isvirtual'] == '1': continue
        label = work['classification']
        groups[kind(label)].append([
            work['objectid'], work['title'], work['attribution'], work['displaydate'],
            year(work['beginyear']), year(work['endyear']), label, work['medium'],
            work['dimensions'], work['creditline'], image['iiifurl'].rstrip('/'),
            year(image['width']), year(image['height']), ', '.join(sorted(artists[work['objectid']]))])
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'source': BASE, 'generated': datetime.now(timezone.utc).isoformat(),
                'imagePolicy': 'https://www.nga.gov/artworks/free-images-and-open-access',
                'selection': 'openaccess=1; viewtype=primary; non-virtual objects',
                'columns': COLUMNS, 'total': sum(map(len, groups.values())), 'shards': []}
    for category, works in sorted(groups.items()):
        works.sort(key=lambda work: int(work[0]))
        for start in range(0, len(works), 2000):
            payload = json.dumps(works[start:start+2000], ensure_ascii=False, separators=(',', ':')).encode('utf8')
            name = category + '-' + hashlib.sha256(payload).hexdigest()[:12] + '.json'
            (OUT / name).write_bytes(payload)
            manifest['shards'].append({'file': name, 'type': category, 'count': len(works[start:start+2000])})
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    # Remove only obsolete generated shards in this script's fixed output folder.
    keep = {shard['file'] for shard in manifest['shards']}
    for old in OUT.glob('*.json'):
        if re.fullmatch(r'[a-z]+-[a-f0-9]{12}\.json', old.name) and old.name not in keep: old.unlink()
    print(json.dumps({key:len(value) for key,value in groups.items()}))
    print('Total:',manifest['total'],'Shards:',len(manifest['shards']))

if __name__ == '__main__': main()
