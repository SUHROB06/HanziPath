#!/usr/bin/env python3
"""Build the HanziPath HSK catalogue from pinned, attributed source datasets.

The script keeps the HSK 3.0 (2026) word list and the legacy HSK 2.0 list
separate, merges identical word/readings, attaches licensed graded examples,
and carries old local progress IDs forward for migration.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path
import unicodedata

MARPALO_REPO = "marpalo/hsk-vocabulary-dataset"
MARPALO_SHA = "c24f2d32b6d03a39423eae871d3197df0df1edc8"
ZHONGDEX_REPO = "saymei/zhongdex"
ZHONGDEX_SHA = "8ee771fd915b2821a1302ff50c79d8932f80b0a8"

POS_MAP = {
    "n": "noun", "N": "noun", "noun": "noun",
    "v": "verb", "V": "verb", "verb": "verb",
    "adj": "adjective", "Adj": "adjective", "adjective": "adjective",
    "adv": "adverb", "Adv": "adverb", "adverb": "adverb",
    "pron": "pronoun", "Pron": "pronoun", "pronoun": "pronoun",
    "num": "numeral", "Num": "numeral", "numeral": "numeral",
    "prep": "preposition", "Prep": "preposition", "preposition": "preposition",
    "conj": "conjunction", "Conj": "conjunction", "conjunction": "conjunction",
    "part": "particle", "Part": "particle", "particle": "particle",
    "clf": "classifier", "Clf": "classifier", "classifier": "classifier",
    "m": "measure word", "M": "measure word", "measure": "measure word",
    "int": "interjection", "Int": "interjection", "interjection": "interjection",
    "aux": "auxiliary", "Aux": "auxiliary", "auxiliary": "auxiliary",
    "det": "determiner", "Det": "determiner", "determiner": "determiner",
    "onom": "onomatopoeia", "Onomat": "onomatopoeia",
    "phrase": "phrase", "idiom": "idiom", "character": "character",
}

def norm_pinyin(value: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", str(value or "")).lower())

def base_pinyin(value: str) -> str:
    text = str(value or "").lower()
    for marked in "ǖǘǚǜ":
        text = text.replace(marked, "v")
    text = text.replace("ü", "v")
    return "".join(
        char for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn" and not char.isspace()
    )

def norm_pinyin_num(value: str) -> str:
    return re.sub(r"[\s'’]+", "", unicodedata.normalize("NFC", str(value or "")).lower())

def clean_word(value: str) -> str:
    # Source IDs such as 本1 / 点2 disambiguate POS rows; the trailing digit
    # is not part of the Chinese spelling.
    return re.sub(r"\d+$", "", str(value or "")).strip()

def unique_text(values):
    result = []
    for value in values:
        if not isinstance(value, str):
            continue
        value = value.strip()
        if value and value not in result:
            result.append(value)
    return result

def normalize_pos(values):
    result = []
    for value in values or []:
        mapped = POS_MAP.get(value, POS_MAP.get(str(value).lower(), str(value).lower()))
        if mapped and mapped not in result:
            result.append(mapped)
    return sorted(result)

def download_repo(repo: str, sha: str, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / f"{repo.split('/')[-1]}-{sha[:8]}.zip"
    url = f"https://github.com/{repo}/archive/{sha}.zip"
    if not archive.exists():
        print(f"Downloading {repo}@{sha[:8]} ...")
        request = urllib.request.Request(url, headers={"User-Agent": "HanziPath-vocabulary-builder"})
        with urllib.request.urlopen(request, timeout=180) as response:
            archive.write_bytes(response.read())
    with zipfile.ZipFile(archive) as zipped:
        roots = sorted({name.split("/")[0] for name in zipped.namelist() if "/" in name})
        if not roots:
            raise RuntimeError(f"Could not find repository root in {archive}")
        root = destination / roots[0]
        if not root.exists():
            zipped.extractall(destination)
    return root

def resolve_source_dir(argument: str | None, repo: str, sha: str, cache: Path) -> Path:
    if argument:
        path = Path(argument).resolve()
        if not path.exists():
            raise FileNotFoundError(path)
        return path
    return download_repo(repo, sha, cache)

def load_old_translations(path: Path):
    if not path.exists():
        return {}, {}
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("entries", []) if isinstance(data, dict) else data
    exact = collections.defaultdict(list)
    by_word = collections.defaultdict(list)
    for index, row in enumerate(rows):
        word = row.get("hanzi", "")
        pinyin = row.get("pinyin", "")
        if not word or not pinyin:
            continue
        row = dict(row)
        row["_legacyId"] = row.get("sourceEntryKey") or f"review-row-{index + 1:05d}"
        exact[(word, norm_pinyin(pinyin))].append(row)
        by_word[word].append(row)
    return exact, by_word

def find_old_translations(word, pinyin, exact, by_word):
    rows = exact.get((word, norm_pinyin(pinyin)), [])
    if rows:
        return rows
    candidates = [
        row for row in by_word.get(word, [])
        if base_pinyin(row.get("pinyin", "")) == base_pinyin(pinyin)
    ]
    if candidates and len({norm_pinyin(row.get("pinyin", "")) for row in candidates}) == 1:
        return candidates
    all_rows = by_word.get(word, [])
    if all_rows and len({base_pinyin(row.get("pinyin", "")) for row in all_rows}) == 1:
        return all_rows
    return []

def best_example(candidates):
    if not candidates:
        return None
    def score(item):
        headword, sentence = item
        slot = headword.get("slot", "")
        slot_rank = {"atLevel": 0, "stretch": 1, "easy": 2}.get(slot, 3)
        band = headword.get("band") or sentence.get("zsg") or 7
        grade = sentence.get("zsg") or band
        return (
            0 if sentence.get("beyondHskTokens", 0) == 0 else 1,
            slot_rank,
            abs(int(grade) - int(band)),
            int(sentence.get("charLen") or len(sentence.get("hanzi", ""))),
            str(sentence.get("id", "")),
        )
    return min(candidates, key=score)[1]

def build_catalog(marpalo_root: Path, zhongdex_root: Path, old_path: Path, output: Path):
    exact_old, old_by_word = load_old_translations(old_path)

    # Sentence links use the exact Zhongdex word ID. Keep source IDs intact
    # so polyphonic words and distinct parts of speech do not get cross-wired.
    examples_by_id = collections.defaultdict(list)
    sentence_path = zhongdex_root / "data" / "sentences.jsonl"
    sentence_count = 0
    for line in sentence_path.open(encoding="utf-8"):
        if not line.strip():
            continue
        sentence = json.loads(line)
        sentence_count += 1
        if not sentence.get("hanzi") or not sentence.get("pinyin") or not sentence.get("english"):
            continue
        for headword in sentence.get("headwords", []):
            word_id = headword.get("wordId")
            if word_id:
                examples_by_id[word_id].append((headword, sentence))

    # Build HSK 3.0 (2026) from the source's vendored 11,092-row official list.
    hsk3_path = zhongdex_root / "data" / "hsk_bands.json"
    hsk3_rows = json.loads(hsk3_path.read_text(encoding="utf-8"))
    catalog = {}
    hsk3_ids = collections.defaultdict(list)

    for row in hsk3_rows:
        word = row.get("simplified", "").strip()
        pinyin = row.get("pinyin", {}).get("marked", "")
        pinyin_num = row.get("pinyin", {}).get("numbered", "")
        if not word or not pinyin:
            continue
        key = (word, norm_pinyin(pinyin))
        band30 = row.get("hsk", {}).get("band2026")
        band20 = row.get("hsk", {}).get("band2_0")
        definitions = unique_text([definition.get("text", "") for definition in row.get("definitions", [])])
        pos = normalize_pos(row.get("pos", []))
        example = best_example(examples_by_id.get(row.get("id", ""), []))

        if key not in catalog:
            catalog[key] = {
                "sourceEntryKey": f"hsk3:{word}:{norm_pinyin_num(pinyin_num)}",
                "hanzi": word,
                "traditional": row.get("traditional", word),
                "pinyin": pinyin,
                "pinyinNum": pinyin_num,
                "ru": "",
                "en": "; ".join(definitions),
                "uz": "",
                "ruStatus": "missing_translation",
                "enStatus": "source_verified",
                "uzStatus": "missing_translation",
                "membershipStatus": "source_verified",
                "level20": band20,
                "level30": band30,
                "level20Memberships": [band20] if band20 is not None else [],
                "level30Memberships": [band30] if band30 is not None else [],
                "partOfSpeech": pos,
                "example": example.get("hanzi", "") if example else "",
                "examplePinyin": example.get("pinyin", "") if example else "",
                "exampleRu": "",
                "exampleEn": example.get("english", "") if example else "",
                "exampleUz": "",
                "exampleSource": "Zhongdex / SayMei",
                "exampleSourceId": example.get("id", "") if example else "",
                "exampleLicense": "CC BY-SA 4.0",
                "exampleStatus": "source_curated_unverified" if example else "missing",
                "legacyIds": [],
                "sourceIds": [],
                "membershipSource": "HSK 3.0 (2026) official word list",
                "definitionSource": "CC-CEDICT",
                "dataLicense": "CC BY-SA 4.0",
            }
        else:
            current = catalog[key]
            current["en"] = "; ".join(unique_text(current["en"].split("; ") + definitions))
            current["partOfSpeech"] = sorted(set(current["partOfSpeech"]) | set(pos))
            if band30 is not None:
                current["level30Memberships"] = sorted(set(current["level30Memberships"] + [band30]))
                current["level30"] = min(current["level30Memberships"])
            if band20 is not None:
                current["level20Memberships"] = sorted(set(current["level20Memberships"] + [band20]))
                current["level20"] = min(current["level20Memberships"])
            if not current["example"] and example:
                current["example"] = example.get("hanzi", "")
                current["examplePinyin"] = example.get("pinyin", "")
                current["exampleEn"] = example.get("english", "")
                current["exampleSourceId"] = example.get("id", "")
                current["exampleStatus"] = "source_curated_unverified"
        if row.get("id"):
            hsk3_ids[key].append(row["id"])
            catalog[key]["sourceIds"] = unique_text(catalog[key]["sourceIds"] + list(row.get("sourceIds", [])))

    # Add the complete HSK 2.0 (2009) list. Entries already present in HSK 3.0
    # gain an HSK 2.0 membership; older-only words become their own entries.
    hsk20_files = sorted((marpalo_root / "data").glob("hsk20-words-*.json"))
    hsk20_source_rows = 0
    hsk20_membership_keys = set()
    hsk3_by_word_base = collections.defaultdict(list)
    for key, entry in catalog.items():
        hsk3_by_word_base[(key[0], base_pinyin(entry["pinyin"]))].append(key)

    for file in hsk20_files:
        payload = json.loads(file.read_text(encoding="utf-8"))
        hsk20_source_rows += int(payload.get("count", len(payload.get("items", []))))
        for item in payload.get("items", []):
            word = clean_word(item.get("word", ""))
            level = (item.get("hsk20") or {}).get("level")
            for definition in item.get("official_definitions", []):
                pinyin = definition.get("pinyin", "")
                pinyin_num = definition.get("pinyin_num", "")
                if not word or not pinyin:
                    continue
                key = (word, norm_pinyin(pinyin))
                hsk20_membership_keys.add(key)
                target_key = key if key in catalog else None
                if target_key is None:
                    base_candidates = hsk3_by_word_base.get((word, base_pinyin(pinyin)), [])
                    if len(base_candidates) == 1:
                        target_key = base_candidates[0]
                full_definitions = item.get("full_definitions", [])
                matching_full = [
                    entry for entry in full_definitions
                    if norm_pinyin_num(entry.get("pinyin_num", "")) == norm_pinyin_num(pinyin_num)
                ]
                english = unique_text([
                    meaning
                    for entry in matching_full
                    for meaning in entry.get("meanings", [])
                ])
                if not english:
                    english = unique_text(definition.get("meanings", []))
                pos = normalize_pos([definition.get("pos", "")])

                if target_key is not None:
                    target = catalog[target_key]
                    if level is not None:
                        target["level20Memberships"] = sorted(set(target["level20Memberships"] + [level]))
                        target["level20"] = min(target["level20Memberships"])
                    target["partOfSpeech"] = sorted(set(target["partOfSpeech"]) | set(pos))
                    if not target["en"] and english:
                        target["en"] = "; ".join(english)
                    target["sourceIds"] = unique_text(target["sourceIds"] + [str(item.get("id", ""))])
                    continue

                new_key = (word, norm_pinyin(pinyin))
                if new_key not in catalog:
                    catalog[new_key] = {
                        "sourceEntryKey": f"hsk20:{word}:{norm_pinyin_num(pinyin_num)}",
                        "hanzi": word,
                        "traditional": word,
                        "pinyin": pinyin,
                        "pinyinNum": pinyin_num,
                        "ru": "",
                        "en": "; ".join(english),
                        "uz": "",
                        "ruStatus": "missing_translation",
                        "enStatus": "source_verified" if english else "missing_translation",
                        "uzStatus": "missing_translation",
                        "membershipStatus": "source_verified",
                        "level20": level,
                        "level30": None,
                        "level20Memberships": [level] if level is not None else [],
                        "level30Memberships": [],
                        "partOfSpeech": pos,
                        "example": "",
                        "examplePinyin": "",
                        "exampleRu": "",
                        "exampleEn": "",
                        "exampleUz": "",
                        "exampleSource": "",
                        "exampleSourceId": "",
                        "exampleLicense": "",
                        "exampleStatus": "missing",
                        "legacyIds": [],
                        "sourceIds": [str(item.get("id", ""))],
                        "membershipSource": "HSK 2.0 (2009) official word list",
                        "definitionSource": "CC-CEDICT / official HSK gloss",
                        "dataLicense": "CC BY-SA 4.0",
                    }
                else:
                    target = catalog[new_key]
                    if level is not None:
                        target["level20Memberships"] = sorted(set(target["level20Memberships"] + [level]))
                        target["level20"] = min(target["level20Memberships"])
                    target["partOfSpeech"] = sorted(set(target["partOfSpeech"]) | set(pos))
                    target["en"] = "; ".join(unique_text(target["en"].split("; ") + english))

    # Bring across the existing RU/UZ draft translations while retaining their
    # unverified status. No draft translation is silently marked as verified.
    missing_ru = 0
    missing_uz = 0
    legacy_migrated = 0
    for (word, pinyin_key), entry in catalog.items():
        candidates = find_old_translations(word, entry["pinyin"], exact_old, old_by_word)
        if candidates:
            ru_values = unique_text([row.get("ru", "") for row in candidates])
            uz_values = unique_text([row.get("uz", "") for row in candidates])
            traditional_values = unique_text([row.get("traditional", "") for row in candidates])
            entry["ru"] = " / ".join(ru_values)
            entry["uz"] = " / ".join(uz_values)
            entry["traditional"] = traditional_values[0] if traditional_values else entry["traditional"]
            entry["ruStatus"] = "source_unverified" if entry["ru"] else "missing_translation"
            entry["uzStatus"] = "source_unverified" if entry["uz"] else "missing_translation"
            entry["legacyIds"] = unique_text(entry["legacyIds"] + [row["_legacyId"] for row in candidates])
            legacy_migrated += len(candidates)
        if not entry["ru"]:
            missing_ru += 1
        if not entry["uz"]:
            missing_uz += 1

    entries = sorted(
        catalog.values(),
        key=lambda entry: (entry["hanzi"], norm_pinyin(entry["pinyin"]), entry["sourceEntryKey"]),
    )
    stats = {
        "hsk30SourceRows": len(hsk3_rows),
        "hsk30UniqueWordReadings": len(hsk3_ids),
        "hsk20SourceRows": hsk20_source_rows,
        "hsk20UniqueWordReadings": len(hsk20_membership_keys),
        "totalUniqueWordReadings": len(entries),
        "hsk30EntriesWithExamples": sum(1 for entry in entries if entry["level30"] is not None and entry["example"]),
        "entriesWithExamples": sum(1 for entry in entries if entry["example"]),
        "missingRussian": missing_ru,
        "missingUzbek": missing_uz,
        "legacyProgressIdsMigrated": legacy_migrated,
        "sentenceSourceRows": sentence_count,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "schema": "hanzipath/vocabulary-catalog/v2",
        "sources": {
            "hsk30": {
                "repository": ZHONGDEX_REPO,
                "commit": ZHONGDEX_SHA,
                "description": "HSK 3.0 (2026) 11,092-row word list and graded examples",
                "license": "CC BY-SA 4.0",
            },
            "hsk20": {
                "repository": MARPALO_REPO,
                "commit": MARPALO_SHA,
                "description": "Official HSK 2.0 (2009) word list",
                "license": "CC BY 4.0; CC-CEDICT definitions CC BY-SA 4.0",
            },
        },
        "stats": stats,
        "entries": entries,
    }
    output.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"Wrote {output} ({output.stat().st_size:,} bytes)")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--marpalo-dir")
    parser.add_argument("--zhongdex-dir")
    parser.add_argument("--cache-dir", default=".cache/vocabulary-sources")
    parser.add_argument("--old-candidates", default="public/vocabulary-review.json")
    parser.add_argument("--output", default="public/vocabulary-catalog.json")
    args = parser.parse_args()

    root = Path.cwd()
    cache = root / args.cache_dir
    marpalo = resolve_source_dir(args.marpalo_dir, MARPALO_REPO, MARPALO_SHA, cache)
    zhongdex = resolve_source_dir(args.zhongdex_dir, ZHONGDEX_REPO, ZHONGDEX_SHA, cache)
    build_catalog(marpalo, zhongdex, root / args.old_candidates, root / args.output)

if __name__ == "__main__":
    main()
