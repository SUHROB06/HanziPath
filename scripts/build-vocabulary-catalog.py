#!/usr/bin/env python3
"""Build separate, attributed HSK 2.0, HSK 3.0 and RU/UZ translation assets."""
from __future__ import annotations
import argparse, collections, csv, json, re, shutil, urllib.request, zipfile
from pathlib import Path
import unicodedata

MARPALO_REPO = "marpalo/hsk-vocabulary-dataset"
MARPALO_SHA = "c24f2d32b6d03a39423eae871d3197df0df1edc8"
ZHONGDEX_REPO = "saymei/zhongdex"
ZHONGDEX_SHA = "8ee771fd915b2821a1302ff50c79d8932f80b0a8"
ZITOU_REPO = "Maqsudjonpolatov/hsk-chinese-uzbek-russian"
ZITOU_SHA = "759f6b2735774ace66ca277be65a20370b8a8b56"

POS_MAP = {
    "n":"noun","N":"noun","noun":"noun","v":"verb","V":"verb","verb":"verb",
    "adj":"adjective","Adj":"adjective","adjective":"adjective","adv":"adverb","Adv":"adverb","adverb":"adverb",
    "pron":"pronoun","Pron":"pronoun","pronoun":"pronoun","num":"numeral","Num":"numeral","numeral":"numeral",
    "prep":"preposition","Prep":"preposition","preposition":"preposition","conj":"conjunction","Conj":"conjunction","conjunction":"conjunction",
    "part":"particle","Part":"particle","particle":"particle","clf":"classifier","Clf":"classifier","classifier":"classifier",
    "m":"measure word","M":"measure word","measure":"measure word","int":"interjection","Int":"interjection","interjection":"interjection",
    "aux":"auxiliary","Aux":"auxiliary","auxiliary":"auxiliary","det":"determiner","Det":"determiner","determiner":"determiner",
    "onom":"onomatopoeia","Onomat":"onomatopoeia","phrase":"phrase","idiom":"idiom","character":"character",
}

def norm_pinyin(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", str(value or "")).lower())

def norm_pinyin_num(value):
    return re.sub(r"[\s'’]+", "", unicodedata.normalize("NFC", str(value or "")).lower())

def base_pinyin(value):
    text = str(value or "").lower()
    for marked in "ǖǘǚǜ":
        text = text.replace(marked, "v")
    text = text.replace("ü", "v")
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn" and not c.isspace())

def clean_word(value):
    return re.sub(r"\d+$", "", str(value or "")).strip()

def unique_text(values):
    result = []
    for value in values:
        if isinstance(value, str) and value.strip() and value.strip() not in result:
            result.append(value.strip())
    return result

def normalize_pos(values):
    result = []
    for value in values or []:
        mapped = POS_MAP.get(value, POS_MAP.get(str(value).lower(), str(value).lower()))
        if mapped and mapped not in result:
            result.append(mapped)
    return sorted(result)

def merge_attribution(existing, incoming):
    result = list(existing or [])
    seen = {(x.get("source"), x.get("sourceKey"), x.get("license")) for x in result}
    for item in incoming or []:
        key = (item.get("source"), item.get("sourceKey"), item.get("license"))
        if key not in seen:
            result.append(item)
            seen.add(key)
    return result

def download_repo(repo, sha, destination):
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / f"{repo.split('/')[-1]}-{sha[:8]}.zip"
    if not archive.exists():
        request = urllib.request.Request(f"https://github.com/{repo}/archive/{sha}.zip", headers={"User-Agent":"HanziPath-vocabulary-builder"})
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

def resolve_source_dir(argument, repo, sha, cache):
    if argument:
        path = Path(argument).resolve()
        if not path.exists():
            raise FileNotFoundError(path)
        return path
    return download_repo(repo, sha, cache)

def load_old_translations(path):
    exact, by_word = collections.defaultdict(list), collections.defaultdict(list)
    if not path.exists():
        return exact, by_word
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("entries", []) if isinstance(data, dict) else data
    for index, row in enumerate(rows):
        word, pinyin = row.get("hanzi", ""), row.get("pinyin", "")
        if not word or not pinyin:
            continue
        item = dict(row)
        item["_legacyId"] = row.get("sourceEntryKey") or f"review-row-{index+1:05d}"
        exact[(word, norm_pinyin(pinyin))].append(item)
        by_word[word].append(item)
    return exact, by_word

def load_zitou_translations(path):
    exact, by_word = collections.defaultdict(list), collections.defaultdict(list)
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            word, pinyin_num = row.get("simplified", ""), row.get("pinyin_numeric", "")
            if word and pinyin_num:
                exact[(word, norm_pinyin_num(pinyin_num))].append(row)
                by_word[word].append(row)
    return exact, by_word

def find_old_translations(word, pinyin, exact, by_word):
    rows = exact.get((word, norm_pinyin(pinyin)), [])
    if rows:
        return rows
    candidates = [r for r in by_word.get(word, []) if base_pinyin(r.get("pinyin","")) == base_pinyin(pinyin)]
    if candidates and len({norm_pinyin(r.get("pinyin","")) for r in candidates}) == 1:
        return candidates
    all_rows = by_word.get(word, [])
    if all_rows and len({base_pinyin(r.get("pinyin","")) for r in all_rows}) == 1:
        return all_rows
    return []

def find_zitou_translations(entry, exact, by_word):
    word = entry["hanzi"]
    pinyin_num = norm_pinyin_num(entry.get("pinyinNum",""))
    rows = exact.get((word, pinyin_num), [])
    if rows:
        return rows
    candidates = [r for r in by_word.get(word, []) if base_pinyin(r.get("pinyin","")) == base_pinyin(entry.get("pinyin",""))]
    if candidates and len({norm_pinyin_num(r.get("pinyin_numeric","")) for r in candidates}) == 1:
        return candidates
    all_rows = by_word.get(word, [])
    if all_rows and len({norm_pinyin_num(r.get("pinyin_numeric","")) for r in all_rows}) == 1:
        return all_rows
    return []

def best_example(candidates):
    if not candidates:
        return None
    def score(item):
        headword, sentence = item
        slot = {"atLevel":0,"stretch":1,"easy":2}.get(headword.get("slot",""),3)
        band = headword.get("band") or sentence.get("zsg") or 7
        grade = sentence.get("zsg") or band
        return (0 if sentence.get("beyondHskTokens",0)==0 else 1, slot, abs(int(grade)-int(band)), int(sentence.get("charLen") or len(sentence.get("hanzi",""))), str(sentence.get("id","")))
    return min(candidates, key=score)[1]

def write_json(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, separators=(",",":")) + "\n", encoding="utf-8")
    print(f"Wrote {path} ({path.stat().st_size:,} bytes)")

def copy_source_licenses(marpalo_root, zhongdex_root, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    for source, target in [
        (zhongdex_root/"data"/"LICENSE", output_dir/"zhongdex-data-LICENSE.txt"),
        (zhongdex_root/"NOTICE", output_dir/"zhongdex-NOTICE.txt"),
        (marpalo_root/"LICENSE", output_dir/"marpalo-LICENSE.txt"),
        (marpalo_root/"NOTICE.md", output_dir/"marpalo-NOTICE.md"),
    ]:
        if source.exists():
            shutil.copyfile(source, target)

def build_catalog(marpalo_root, zhongdex_root, zitou_csv, old_path, hsk30_output, hsk20_output, translations_output):
    exact_old, old_by_word = load_old_translations(old_path)
    exact_zitou, zitou_by_word = load_zitou_translations(zitou_csv)

    examples_by_id = collections.defaultdict(list)
    sentence_path = zhongdex_root/"data"/"sentences.jsonl"
    sentence_count = 0
    for line in sentence_path.open(encoding="utf-8"):
        if not line.strip():
            continue
        sentence = json.loads(line)
        sentence_count += 1
        if not sentence.get("hanzi") or not sentence.get("pinyin") or not sentence.get("english"):
            continue
        for headword in sentence.get("headwords", []):
            if headword.get("wordId"):
                examples_by_id[headword["wordId"]].append((headword, sentence))

    # HSK 3.0 (2026) with CC-CEDICT definitions and graded examples: CC BY-SA.
    hsk3_rows = json.loads((zhongdex_root/"data"/"hsk_bands.json").read_text(encoding="utf-8"))
    # A small number of HSK 3.0 rows have no CC-CEDICT gloss in the Zhongdex
    # snapshot. Fill only those gaps from the same licensed CC-CEDICT field.
    cedict_fallback = collections.defaultdict(list)
    for file in sorted((marpalo_root/"data").glob("hsk30-words-*.json")):
        payload = json.loads(file.read_text(encoding="utf-8"))
        for item in payload.get("items", []):
            word = clean_word(item.get("word", ""))
            for definition in item.get("full_definitions", []):
                pinyin_num = norm_pinyin_num(definition.get("pinyin_num", ""))
                if word and pinyin_num:
                    cedict_fallback[(word, pinyin_num)] = unique_text(
                        cedict_fallback[(word, pinyin_num)] + list(definition.get("meanings", []))
                    )

    hsk30 = {}
    for row in hsk3_rows:
        word = row.get("simplified","").strip()
        pinyin = row.get("pinyin",{}).get("marked","")
        pinyin_num = row.get("pinyin",{}).get("numbered","")
        if not word or not pinyin:
            continue
        key = (word, norm_pinyin_num(pinyin_num) or norm_pinyin(pinyin))
        band = row.get("hsk",{}).get("band2026")
        meanings = unique_text([d.get("text","") for d in row.get("definitions",[])])
        fallback_meanings = cedict_fallback.get((word, norm_pinyin_num(pinyin_num)), [])
        if not meanings and fallback_meanings:
            meanings = fallback_meanings
        pos = normalize_pos(row.get("pos",[]))
        attribution = [
            {"source":d.get("source",""),"sourceKey":d.get("sourceKey",""),"license":d.get("license","")}
            for d in row.get("definitions",[]) if d.get("source") or d.get("license")
        ]
        if not attribution and fallback_meanings:
            attribution = [{"source":"CC-CEDICT","sourceKey":f"{word}|{norm_pinyin_num(pinyin_num)}","license":"CC BY-SA 4.0"}]
        example = best_example(examples_by_id.get(row.get("id",""),[]))
        if key not in hsk30:
            hsk30[key] = {
                "sourceEntryKey":f"hsk3:{word}:{norm_pinyin_num(pinyin_num)}",
                "wordKey":f"{word}|{norm_pinyin_num(pinyin_num)}",
                "hanzi":word,"traditional":row.get("traditional",word),
                "pinyin":pinyin,"pinyinNum":pinyin_num,
                "en":"; ".join(meanings),"enStatus":"source_verified",
                "membershipStatus":"source_verified",
                "level20":None,"level30":band,"level20Memberships":[],
                "level30Memberships":[band] if band is not None else [],
                "partOfSpeech":pos,
                "example":example.get("hanzi","") if example else "",
                "examplePinyin":example.get("pinyin","") if example else "",
                "exampleRu":"","exampleEn":example.get("english","") if example else "",
                "exampleUz":"","exampleSource":"Zhongdex / SayMei",
                "exampleSourceId":example.get("id","") if example else "",
                "exampleLicense":"CC BY-SA 4.0",
                "exampleStatus":"source_curated_unverified" if example else "missing",
                "legacyIds":[],"sourceIds":unique_text(list(row.get("sourceIds",[]))),
                "definitionAttribution":merge_attribution([],attribution),
                "membershipSource":"HSK 3.0 (2026) word list, Zhongdex",
                "definitionSource":"CC-CEDICT","dataLicense":"CC BY-SA 4.0",
            }
        else:
            current=hsk30[key]
            current["en"]="; ".join(unique_text(current["en"].split("; ")+meanings))
            current["partOfSpeech"]=sorted(set(current["partOfSpeech"])|set(pos))
            current["sourceIds"]=unique_text(current["sourceIds"]+list(row.get("sourceIds",[])))
            current["definitionAttribution"]=merge_attribution(current["definitionAttribution"],attribution)
            if band is not None:
                current["level30Memberships"]=sorted(set(current["level30Memberships"]+[band]))
                current["level30"]=min(current["level30Memberships"])
            if not current["example"] and example:
                current["example"]=example.get("hanzi","")
                current["examplePinyin"]=example.get("pinyin","")
                current["exampleEn"]=example.get("english","")
                current["exampleSourceId"]=example.get("id","")
                current["exampleStatus"]="source_curated_unverified"

    # HSK 2.0 list: use only its CC BY 4.0 official glosses, not the separate
    # CC-CEDICT full_definitions field (which is CC BY-SA).
    hsk20_files=sorted((marpalo_root/"data").glob("hsk20-words-*.json"))
    hsk20_source_rows=0
    hsk20={}
    for file in hsk20_files:
        payload=json.loads(file.read_text(encoding="utf-8"))
        hsk20_source_rows+=int(payload.get("count",len(payload.get("items",[]))))
        for item in payload.get("items",[]):
            word=clean_word(item.get("word",""))
            level=(item.get("hsk20") or {}).get("level")
            for definition in item.get("official_definitions",[]):
                pinyin=definition.get("pinyin","")
                pinyin_num=definition.get("pinyin_num","")
                if not word or not pinyin:
                    continue
                key=(word,norm_pinyin_num(pinyin_num) or norm_pinyin(pinyin))
                meanings=unique_text(definition.get("meanings",[]))
                pos=normalize_pos([definition.get("pos","")])
                attribution=[{"source":"Marpalo HSK Vocabulary Dataset","sourceKey":str(item.get("id","")),"license":"CC BY 4.0"}]
                if key not in hsk20:
                    hsk20[key]={
                        "sourceEntryKey":f"hsk20:{word}:{norm_pinyin_num(pinyin_num)}",
                        "wordKey":f"{word}|{norm_pinyin_num(pinyin_num)}",
                        "hanzi":word,"traditional":word,"pinyin":pinyin,"pinyinNum":pinyin_num,
                        "en":"; ".join(meanings),"enStatus":"source_verified" if meanings else "missing_translation",
                        "membershipStatus":"source_verified","level20":level,"level30":None,
                        "level20Memberships":[level] if level is not None else [],"level30Memberships":[],
                        "partOfSpeech":pos,"example":"","examplePinyin":"","exampleRu":"",
                        "exampleEn":"","exampleUz":"","exampleSource":"","exampleSourceId":"",
                        "exampleLicense":"","exampleStatus":"missing","legacyIds":[],
                        "sourceIds":[str(item.get("id",""))] if item.get("id") else [],
                        "definitionAttribution":merge_attribution([],attribution),
                        "membershipSource":"HSK 2.0 (2009) word list, Marpalo",
                        "definitionSource":"Official HSK 2.0 gloss","dataLicense":"CC BY 4.0",
                    }
                else:
                    current=hsk20[key]
                    current["en"]="; ".join(unique_text(current["en"].split("; ")+meanings))
                    current["partOfSpeech"]=sorted(set(current["partOfSpeech"])|set(pos))
                    current["sourceIds"]=unique_text(current["sourceIds"]+[str(item.get("id",""))])
                    current["definitionAttribution"]=merge_attribution(current["definitionAttribution"],attribution)
                    if level is not None:
                        current["level20Memberships"]=sorted(set(current["level20Memberships"]+[level]))
                        current["level20"]=min(current["level20Memberships"])

    # RU/UZ translations are a separate CC BY 4.0 asset, never folded into
    # the CC BY-SA vocabulary/example corpus.
    translations=[]
    entries_with_zitou=0
    entries_with_old_fallback=0
    legacy_migrated=0
    all_keys=sorted(set(hsk30)|set(hsk20))
    for key in all_keys:
        primary=hsk30.get(key) or hsk20[key]
        word,pinyin=primary["hanzi"],primary["pinyin"]
        zitou_rows=find_zitou_translations(primary,exact_zitou,zitou_by_word)
        old_rows=find_old_translations(word,pinyin,exact_old,old_by_word)
        legacy_ids=[row["_legacyId"] for row in old_rows]
        if legacy_ids:
            if key in hsk30:
                hsk30[key]["legacyIds"]=unique_text(hsk30[key]["legacyIds"]+legacy_ids)
            if key in hsk20:
                hsk20[key]["legacyIds"]=unique_text(hsk20[key]["legacyIds"]+legacy_ids)
            legacy_migrated+=len(legacy_ids)

        if zitou_rows:
            ru_values=unique_text([row.get("russian","") for row in zitou_rows])
            uz_values=unique_text([row.get("uzbek","") for row in zitou_rows])
            traditional_values=unique_text([row.get("traditional","") for row in zitou_rows])
            source="Maqsudjonpolatov / Zitou HSK Chinese–Uzbek–Russian"
            license_name="CC BY 4.0"
            status="ai_assisted_unverified"
            ranks=[int(row["frequency_rank"]) for row in zitou_rows if str(row.get("frequency_rank","")).isdigit()]
            frequency_rank=min(ranks) if ranks else None
            entries_with_zitou+=1
        elif old_rows:
            ru_values=unique_text([row.get("ru","") for row in old_rows])
            uz_values=unique_text([row.get("uz","") for row in old_rows])
            traditional_values=unique_text([row.get("traditional","") for row in old_rows])
            source="Zitou HSK Chinese–Uzbek–Russian candidate bundle"
            license_name="CC BY 4.0 (publisher-declared)"
            status="source_unverified"
            frequency_rank=None
            entries_with_old_fallback+=1
        else:
            continue

        ru,uz=" / ".join(ru_values)," / ".join(uz_values)
        if not ru and not uz:
            continue
        translations.append({
            "wordKey":primary["wordKey"],"hanzi":word,"pinyinNum":primary.get("pinyinNum",""),
            "traditional":traditional_values[0] if traditional_values else primary.get("traditional",word),
            "ru":ru,"uz":uz,
            "ruStatus":status if ru else "missing_translation",
            "uzStatus":status if uz else "missing_translation",
            "translationSource":source,"translationLicense":license_name,
            "frequencyRank":frequency_rank,
        })

    sort_key=lambda e:(e["hanzi"],norm_pinyin(e["pinyin"]),e["sourceEntryKey"])
    hsk30_entries=sorted(hsk30.values(),key=sort_key)
    hsk20_entries=sorted(hsk20.values(),key=sort_key)
    translations.sort(key=lambda e:(e["hanzi"],e["wordKey"]))
    translation_keys={entry["wordKey"] for entry in translations}
    total_keys=len(all_keys)
    example_count=sum(1 for entry in hsk30_entries if entry["example"])
    stats={
        "hsk30SourceRows":len(hsk3_rows),
        "hsk30UniqueWordReadings":len(hsk30_entries),
        "hsk30EntriesWithExamples":example_count,
        "hsk30ExampleCoveragePercent":round(example_count/max(1,len(hsk30_entries))*100,2),
        "hsk20SourceRows":hsk20_source_rows,
        "hsk20UniqueWordReadings":len(hsk20_entries),
        "combinedUniqueWordReadings":total_keys,
        "entriesWithZitouTranslations":entries_with_zitou,
        "entriesWithOldCandidateFallback":entries_with_old_fallback,
        "entriesWithRussianOrUzbek":len(translation_keys),
        "missingTranslations":total_keys-len(translation_keys),
        "legacyProgressIdsMigrated":legacy_migrated,
        "sentenceSourceRows":sentence_count,
    }

    sources_hsk30={
        "repository":ZHONGDEX_REPO,"commit":ZHONGDEX_SHA,
        "description":"HSK 3.0 (2026) word list, CC-CEDICT definitions and graded example sentences",
        "license":"CC BY-SA 4.0",
        "attribution":"Zhongdex by SayMei — https://zhongdex.org — CC BY-SA 4.0. Contains data from CC-CEDICT (CC BY-SA 4.0) and the HSK 3.0 (2026) word list.",
    }
    sources_hsk20={
        "repository":MARPALO_REPO,"commit":MARPALO_SHA,
        "description":"HSK 2.0 (2009) word list and official glosses","license":"CC BY 4.0",
    }
    sources_translations={
        "repository":ZITOU_REPO,"commit":ZITOU_SHA,
        "description":"HSK Chinese–Uzbek–Russian vocabulary; AI-assisted translations","license":"CC BY 4.0",
    }

    hsk30_document={
        "schema":"hanzipath/hsk30-catalog/v1","license":"CC BY-SA 4.0",
        "sources":{"hsk30":sources_hsk30,"ccCedict":{
            "source":"CC-CEDICT","home":"https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
            "license":"CC BY-SA 4.0",
            "attribution":"This work uses data from CC-CEDICT, made available by MDBG under the Creative Commons Attribution-ShareAlike 4.0 International licence (https://creativecommons.org/licenses/by-sa/4.0/). Changes were made: entries were selected against the HSK 3.0 (2026) word list, merged with band metadata, re-keyed to HanziPath word-reading IDs, and reformatted.",
        }},
        "stats":{"sourceRows":len(hsk3_rows),"uniqueWordReadings":len(hsk30_entries),"entriesWithExamples":example_count,"exampleCoveragePercent":stats["hsk30ExampleCoveragePercent"]},
        "entries":hsk30_entries,
    }
    hsk20_document={
        "schema":"hanzipath/hsk20-catalog/v1","license":"CC BY 4.0",
        "sources":{"hsk20":sources_hsk20},
        "stats":{"sourceRows":hsk20_source_rows,"uniqueWordReadings":len(hsk20_entries)},
        "entries":hsk20_entries,
    }
    translations_document={
        "schema":"hanzipath/ru-uz-translations/v1","license":"CC BY 4.0",
        "sources":{"translations":sources_translations},
        "stats":{"entries":len(translations),"fromZitouCsv":entries_with_zitou,"fromCandidateFallback":entries_with_old_fallback,"missingFromCombinedCatalog":total_keys-len(translation_keys)},
        "entries":translations,
    }

    write_json(hsk30_output,hsk30_document)
    write_json(hsk20_output,hsk20_document)
    write_json(translations_output,translations_document)
    copy_source_licenses(marpalo_root,zhongdex_root,hsk30_output.parent/"data-licenses")
    return stats

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--marpalo-dir")
    parser.add_argument("--zhongdex-dir")
    parser.add_argument("--cache-dir",default=".cache/vocabulary-sources")
    parser.add_argument("--zitou-csv")
    parser.add_argument("--old-candidates",default="data/source-candidates/vocabulary-review.json")
    parser.add_argument("--hsk30-output",default="public/vocabulary-catalog-hsk30.json")
    parser.add_argument("--hsk20-output",default="public/vocabulary-catalog-hsk20.json")
    parser.add_argument("--translations-output",default="public/vocabulary-translations-ru-uz.json")
    args=parser.parse_args()
    root=Path.cwd()
    cache=root/args.cache_dir
    marpalo=resolve_source_dir(args.marpalo_dir,MARPALO_REPO,MARPALO_SHA,cache)
    zhongdex=resolve_source_dir(args.zhongdex_dir,ZHONGDEX_REPO,ZHONGDEX_SHA,cache)
    zitou_csv=Path(args.zitou_csv).resolve() if args.zitou_csv else root/".cache"/"hsk_uz_ru.csv"
    if not zitou_csv.exists():
        zitou_csv.parent.mkdir(parents=True,exist_ok=True)
        url=f"https://huggingface.co/datasets/{ZITOU_REPO}/resolve/{ZITOU_SHA}/hsk_uz_ru.csv"
        request=urllib.request.Request(url,headers={"User-Agent":"HanziPath-vocabulary-builder"})
        with urllib.request.urlopen(request,timeout=120) as response:
            zitou_csv.write_bytes(response.read())
    stats=build_catalog(marpalo,zhongdex,zitou_csv,root/args.old_candidates,root/args.hsk30_output,root/args.hsk20_output,root/args.translations_output)
    print(json.dumps(stats,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
