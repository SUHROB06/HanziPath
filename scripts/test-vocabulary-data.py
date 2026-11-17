#!/usr/bin/env python3
"""Structural and attribution checks for generated HanziPath dictionary assets."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

def load(name):
    path = PUBLIC / name
    assert path.exists(), f"Missing asset: {path}"
    return json.loads(path.read_text(encoding="utf-8"))

hsk30 = load("vocabulary-catalog-hsk30.json")
hsk20 = load("vocabulary-catalog-hsk20.json")
translations = load("vocabulary-translations-ru-uz.json")
hsk20_examples = load("vocabulary-examples-hsk20.json")

assert hsk30["license"] == "CC BY-SA 4.0"
assert hsk20["license"] == "CC BY 4.0"
assert translations["license"] == "CC BY-SA 4.0"
assert hsk20_examples["license"] == "CC BY-SA 4.0"
assert "reviewFallback" in translations["sources"]

def validate_entries(name, entries, required_level):
    keys = [entry.get("wordKey") for entry in entries]
    ids = [entry.get("sourceEntryKey") for entry in entries]
    assert all(keys), f"{name}: an entry is missing wordKey"
    assert all(ids), f"{name}: an entry is missing sourceEntryKey"
    assert len(keys) == len(set(keys)), f"{name}: duplicate wordKey values"
    assert len(ids) == len(set(ids)), f"{name}: duplicate sourceEntryKey values"
    for entry in entries:
        assert entry.get("hanzi"), f"{name}: missing hanzi"
        assert entry.get("pinyin"), f"{name}: missing pinyin"
        assert entry.get(required_level) is not None, f"{name}: missing {required_level}"
        assert isinstance(entry.get("partOfSpeech", []), list), f"{name}: POS must be an array"
        assert isinstance(entry.get("sourceIds", []), list), f"{name}: sourceIds must be an array"
        assert isinstance(entry.get("legacyIds", []), list), f"{name}: legacyIds must be an array"

validate_entries("HSK 3.0", hsk30["entries"], "level30")
validate_entries("HSK 2.0", hsk20["entries"], "level20")

hsk30_entries = hsk30["entries"]
hsk20_entries = hsk20["entries"]
translation_entries = translations["entries"]
hsk20_example_entries = hsk20_examples["entries"]

assert len(hsk30_entries) == hsk30["stats"]["uniqueWordReadings"]
assert len(hsk20_entries) == hsk20["stats"]["uniqueWordReadings"]
assert len({e["wordKey"] for e in hsk30_entries} | {e["wordKey"] for e in hsk20_entries}) == (
    hsk30["stats"]["uniqueWordReadings"]
    + hsk20["stats"]["uniqueWordReadings"]
    - len({e["wordKey"] for e in hsk30_entries} & {e["wordKey"] for e in hsk20_entries})
)

translation_keys = [entry.get("wordKey") for entry in translation_entries]
assert all(translation_keys), "Translation row is missing wordKey"
assert len(translation_keys) == len(set(translation_keys)), "Duplicate translation wordKey"
catalog_keys = {entry["wordKey"] for entry in hsk30_entries} | {entry["wordKey"] for entry in hsk20_entries}
assert set(translation_keys).issubset(catalog_keys), "Translation points to an unknown wordKey"
for entry in translation_entries:
    assert entry.get("ru") or entry.get("uz"), "Empty translation row"
    assert entry.get("translationSource"), "Translation row missing source attribution"
    assert entry.get("translationLicense"), "Translation row missing licence attribution"
    assert entry.get("ruStatus") and entry.get("uzStatus"), "Translation row missing quality status"

for entry in hsk30_entries:
    if entry.get("en"):
        assert entry.get("definitionAttribution"), f"HSK 3.0 gloss missing attribution: {entry['hanzi']}"
    else:
        assert entry.get("enStatus") == "missing_translation", f"Unmarked missing HSK 3.0 gloss: {entry['hanzi']}"
    if entry.get("example"):
        assert entry.get("examplePinyin"), f"Example missing pinyin: {entry['hanzi']}"
        assert entry.get("exampleSourceId"), f"Example missing source ID: {entry['hanzi']}"
        assert entry.get("exampleLicense") == "CC BY-SA 4.0"

for entry in hsk20_entries:
    if entry.get("en"):
        assert entry.get("definitionAttribution"), f"HSK 2.0 gloss missing attribution: {entry['hanzi']}"

hsk20_keys = {entry["wordKey"] for entry in hsk20_entries}
hsk30_keys = {entry["wordKey"] for entry in hsk30_entries}
example_keys = [entry.get("wordKey") for entry in hsk20_example_entries]
assert all(example_keys), "HSK 2.0 example row is missing wordKey"
assert len(example_keys) == len(set(example_keys)), "Duplicate HSK 2.0 example wordKey"
assert set(example_keys).issubset(hsk20_keys), "HSK 2.0 example points to an unknown wordKey"
for entry in hsk20_example_entries:
    assert entry.get("example") and entry.get("examplePinyin") and entry.get("exampleEn")
    assert entry.get("exampleSourceId") and entry.get("exampleLicense") == "CC BY-SA 4.0"

translation_key_set = set(translation_keys)
hsk20_translation_coverage = len(hsk20_keys & translation_key_set) / len(hsk20_keys)
hsk30_translation_coverage = len(hsk30_keys & translation_key_set) / len(hsk30_keys)
assert hsk30["stats"]["entriesWithExamples"] / len(hsk30_entries) >= 0.99
assert len(hsk20_example_entries) / len(hsk20_entries) >= 0.85
assert len(translation_entries) / len(catalog_keys) >= 0.90
assert hsk20_translation_coverage >= 0.95
assert hsk30_translation_coverage >= 0.65

for relative in [
    "data-attribution.html",
    "data-licenses/zhongdex-data-LICENSE.txt",
    "data-licenses/zhongdex-NOTICE.txt",
    "data-licenses/marpalo-LICENSE.txt",
    "data-licenses/marpalo-NOTICE.md",
]:
    assert (PUBLIC / relative).exists(), f"Missing attribution or licence file: {relative}"

print("Dictionary asset checks passed.")
print(f"HSK 3.0: {len(hsk30_entries):,} unique readings; {hsk30['stats']['entriesWithExamples']:,} examples.")
print(f"HSK 2.0: {len(hsk20_entries):,} unique readings; {len(hsk20_example_entries):,} examples ({len(hsk20_example_entries)/len(hsk20_entries)*100:.1f}%).")
print(f"Combined: {len(catalog_keys):,} unique readings.")
print(f"RU/UZ translations: {len(translation_entries):,} ({len(translation_entries)/len(catalog_keys)*100:.1f}% overall; {hsk20_translation_coverage*100:.1f}% HSK 2.0; {hsk30_translation_coverage*100:.1f}% HSK 3.0).")
