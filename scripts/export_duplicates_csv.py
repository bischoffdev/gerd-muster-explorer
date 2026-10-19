import json
import csv

input_json = r"C:\Users\Kessler Heinz\.gemini\antigravity-ide\scratch\gerd-muster-explorer\data\symmetry_duplicates.json"
output_csv = r"C:\Users\Kessler Heinz\.gemini\antigravity-ide\scratch\gerd-muster-explorer\data\duplikate_d4_symmetrie.csv"

with open(input_json, "r", encoding="utf-8") as f:
    data = json.load(f)

with open(output_csv, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f, delimiter=";")
    writer.writerow([
        "Gruppe_ID",
        "Anzahl_in_Gruppe",
        "Graue_Zellen",
        "Globale_ID",
        "Seite",
        "Spalte",
        "Zeile",
        "Ist_Erstvorkommen",
        "Transformation_zu_Erstvorkommen",
        "Bitmask"
    ])

    for g in data["groups"]:
        gid = g["group_id"]
        cnt = g["count"]
        gray = g["gray_count"]
        for m in g["members"]:
            writer.writerow([
                gid,
                cnt,
                gray,
                m["global_id"],
                m["page"],
                m["col"],
                m["row"],
                "JA" if m["is_first"] else "NEIN",
                m["relation_name"],
                m["raw_bitmask"]
            ])

print(f"Exported CSV to {output_csv}")
