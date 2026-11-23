#!/usr/bin/env python3
"""
Import classes, class features and subclasses from a 5etools `data` dump into the
srd_classes / srd_class_features / srd_subclasses tables.

Reads data/class/class-*.json, flattens the 5etools "entries" format to HTML, and
emits SQL on stdout (TRUNCATE + INSERTs). Load with psql.

Usage:
  python scripts/import_5etools_classes.py "C:/path/5etools/data" > /tmp/classes.sql
"""
import sys, os, json, re, glob

# Windows Python defaults stdout to cp1252; force UTF-8 so psql can read the SQL.
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

DATA = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/eduar/Downloads/5etools-v2.30.0/data"
CLASS_DIR = os.path.join(DATA, "class")

TAG = re.compile(r"\{@(\w+)\s*([^{}]*)\}")

def _disp(tag, content):
    content = content.strip()
    if content == "":
        return ""
    first = content.split("|")[0]
    if tag == "dc":
        return "DC " + first
    if tag == "hit":
        return ("+" + first) if first and first[0].isdigit() else first
    return first

def detag(s):
    prev = None
    while prev != s:
        prev = s
        s = TAG.sub(lambda m: _disp(m.group(1), m.group(2)), s)
    return s.replace("—", "-").strip()

def flatten(node):
    if node is None:
        return ""
    if isinstance(node, str):
        return detag(node)
    if isinstance(node, list):
        out = []
        for x in node:
            if isinstance(x, str):
                out.append("<p>" + detag(x) + "</p>")
            else:
                out.append(flatten(x))
        return "".join(out)
    if isinstance(node, dict):
        t = node.get("type")
        name = node.get("name")
        if t in ("entries", "section", "inset", "insetReadaloud", "variant", "variantSub"):
            inner = flatten(node.get("entries", []))
            if name:
                return "<p><strong>" + detag(name) + ".</strong></p>" + inner
            return inner
        if t == "list":
            items = node.get("items", [])
            lis = "".join("<li>" + _inline(flatten(i)) + "</li>" for i in items)
            return "<ul>" + lis + "</ul>"
        if t == "table":
            return _table(node)
        if t in ("options",):
            return flatten(node.get("entries", []))
        if t == "refOptionalfeature":
            return "<p>" + detag(str(node.get("optionalfeature", "")).split("|")[0]) + "</p>"
        if t in ("refClassFeature", "refSubclassFeature"):
            ref = node.get("classFeature") or node.get("subclassFeature") or ""
            return "<p>" + detag(str(ref).split("|")[0]) + "</p>"
        if t == "quote":
            return "<blockquote>" + flatten(node.get("entries", [])) + "</blockquote>"
        for k in ("entries", "items", "entry"):
            if k in node:
                return flatten(node[k])
        return ""
    return detag(str(node))

def _inline(html):
    # strip a single wrapping <p>..</p> for list items
    if html.startswith("<p>") and html.endswith("</p>") and html.count("<p>") == 1:
        return html[3:-4]
    return html

def _table(node):
    out = "<table>"
    labels = node.get("colLabels")
    if labels:
        out += "<thead><tr>" + "".join("<th>" + detag(str(c)) + "</th>" for c in labels) + "</tr></thead>"
    out += "<tbody>"
    for row in node.get("rows", []):
        cells = row if isinstance(row, list) else [row]
        out += "<tr>" + "".join("<td>" + _inline(flatten(c)) + "</td>" for c in cells) + "</tr>"
    out += "</tbody></table>"
    return out

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def jq(obj):
    return "'" + json.dumps(obj).replace("'", "''") + "'::jsonb"

def class_summary(c):
    hd = c.get("hd", {})
    sp = c.get("startingProficiencies", {}) or {}
    parts = []
    if hd.get("faces"):
        parts.append("<p><strong>Hit Die:</strong> d%s</p>" % hd["faces"])
    if c.get("proficiency"):
        parts.append("<p><strong>Saving Throws:</strong> " + ", ".join(a.upper() for a in c["proficiency"]) + "</p>")
    if sp.get("armor"):
        parts.append("<p><strong>Armor:</strong> " + ", ".join(detag(str(a)) for a in sp["armor"]) + "</p>")
    if sp.get("weapons"):
        parts.append("<p><strong>Weapons:</strong> " + ", ".join(detag(str(w)) for w in sp["weapons"]) + "</p>")
    if sp.get("tools"):
        parts.append("<p><strong>Tools:</strong> " + ", ".join(detag(str(t)) for t in sp["tools"]) + "</p>")
    if c.get("spellcastingAbility"):
        parts.append("<p><strong>Spellcasting Ability:</strong> " + c["spellcastingAbility"].upper() + "</p>")
    return "".join(parts)

# ── collect ──
classes = {}        # name_lower -> class obj
class_feats = {}    # class_name_lower -> [feature obj]
subclasses = {}     # (class_lower, name_lower) -> subclass obj
sub_feats = {}      # (class_lower, shortname_lower, source_lower) -> [feature obj]

files = [f for f in glob.glob(os.path.join(CLASS_DIR, "class-*.json"))
         if "fluff" not in os.path.basename(f)]

for path in sorted(files):
    d = json.load(open(path, encoding="utf-8"))
    for c in d.get("class", []):
        if "_copy" in c:
            continue
        classes.setdefault(c["name"].lower(), c)
    for cf in d.get("classFeature", []):
        if "_copy" in cf:
            continue
        class_feats.setdefault(cf["className"].lower(), []).append(cf)
    for s in d.get("subclass", []):
        if "_copy" in s:
            continue
        subclasses.setdefault((s["className"].lower(), s["name"].lower()), s)
    for sf in d.get("subclassFeature", []):
        if "_copy" in sf:
            continue
        key = (sf["className"].lower(), sf["subclassShortName"].lower(), sf["subclassSource"].lower())
        sub_feats.setdefault(key, []).append(sf)

# ── emit SQL ──
print("BEGIN;")
print("TRUNCATE srd_classes RESTART IDENTITY CASCADE;")
print("TRUNCATE srd_subclasses RESTART IDENTITY CASCADE;")

for name_l, c in sorted(classes.items()):
    name = c["name"]
    hit = c.get("hd", {}).get("faces", 8)
    sca = c.get("spellcastingAbility", "") or ""
    saves = c.get("proficiency", [])
    sp = c.get("startingProficiencies", {}) or {}
    desc = class_summary(c)
    print("INSERT INTO srd_classes (name, hit_die, primary_ability, saving_throws, "
          "armor_proficiencies, weapon_proficiencies, tool_proficiencies, spellcasting_ability, description, is_srd) VALUES ("
          + ", ".join([
              q(name), str(hit), q(""), jq(saves),
              jq(sp.get("armor", [])), jq(sp.get("weapons", [])), jq(sp.get("tools", [])),
              q(sca), q(desc), "TRUE"]) + ");")
    # class features
    feats = sorted(class_feats.get(name_l, []), key=lambda x: (x.get("level", 0), x.get("name", "")))
    seen = set()
    for cf in feats:
        key = (cf.get("level"), cf.get("name"))
        if key in seen:
            continue
        seen.add(key)
        fdesc = flatten(cf.get("entries", []))
        print("INSERT INTO srd_class_features (class_id, name, level, description) VALUES ("
              + "(SELECT id FROM srd_classes WHERE name=" + q(name) + "), "
              + q(cf.get("name", "")) + ", " + str(cf.get("level", 1)) + ", " + q(fdesc) + ");")

for (cls_l, name_l), s in sorted(subclasses.items()):
    cls = s["className"]
    name = s["name"]
    key = (s["className"].lower(), s.get("shortName", s["name"]).lower(), s["source"].lower())
    feats = sorted(sub_feats.get(key, []), key=lambda x: (x.get("level", 0), x.get("name", "")))
    body = []
    for sf in feats:
        body.append("<h3>" + detag(sf.get("name", "")) + " (Level %s)</h3>" % sf.get("level", "?"))
        body.append(flatten(sf.get("entries", [])))
    desc = "".join(body)
    print("INSERT INTO srd_subclasses (class_name, name, description, is_srd) VALUES ("
          + ", ".join([q(cls), q(name), q(desc), "TRUE"]) + ");")

print("COMMIT;")
sys.stderr.write("classes=%d class_features=%d subclasses=%d\n" % (
    len(classes), sum(len(v) for v in class_feats.values()), len(subclasses)))
