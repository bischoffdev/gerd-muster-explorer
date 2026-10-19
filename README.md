# Gerd Doppelsuche — Vollständige D₄-Symmetrie Duplikatanalyse

Vollständige mathematische Untersuchung aller **34.344 Muster** (159 Seiten à 216 Muster) aus `muster1,2.pdf` auf Duplikate unter Berücksichtigung der **Diedergruppe D₄** (8 Symmetrien des Quadrats: Drehungen & Achsenspiegelungen).

---

## 🎯 Zusammenfassung der Gesamtanalyse

Als Duplikat gilt ein Muster, wenn es durch eine der folgenden Operationen auf ein anderes abgebildet werden kann:
1. **Identisch (0° Drehung)**
2. **90° im Uhrzeigersinn gedreht**
3. **180° gedreht**
4. **270° im Uhrzeigersinn gedreht**
5. **Horizontal gespiegelt** (an der horizontalen Achse)
6. **Vertikal gespiegelt** (an der vertikalen Achse)
7. **Diagonal gespiegelt** (Hauptdiagonale / transponiert)
8. **Anti-diagonal gespiegelt** (Nebendiagonale)

### Die Gesamtzahlen aller 159 Seiten:

| Metrik | Wert | Beschreibung |
| :--- | :--- | :--- |
| **Gescannte Muster gesamt** | **34.344** | 159 Seiten × 12 Spalten × 18 Zeilen |
| **Einzigartige Symmetrieklassen ($D_4$)** | **21.351** | Reale, nicht durch Drehung/Spiegelung erzeugbare Ur-Muster |
| **Duplikat-Gruppen ($D_4$)** | **11.781** | Gruppen mit 2 oder mehr Vorkommen im PDF |
| **Muster in Duplikat-Gruppen** | **24.774** | Gesamtzahl aller betroffenen Muster |
| *Vergleich: Exakte Duplikate (0°)* | *8.509* | Reines Duplikat ohne Drehung/Spiegelung |

---

## 📁 Verfügbare Daten & Export-Dateien

Alle Ergebnisse sind im Projektordner hinterlegt:

1. **Excel-Tabelle**: [`data/duplikate_d4_symmetrie.csv`](file:///C:/Users/Kessler%20Heinz/.gemini/antigravity-ide/scratch/gerd-muster-explorer/data/duplikate_d4_symmetrie.csv)
   - Enthält alle 24.774 Duplikat-Vorkommen zeilenweise mit:
     - `Gruppe_ID`
     - `Anzahl_in_Gruppe`
     - `Seite` (1 bis 159)
     - `Spalte` (1 bis 12)
     - `Zeile` (1 bis 18)
     - `Transformation_zu_Erstvorkommen` (z.B. *90° im UZS gedreht*, *Horizontal gespiegelt*, *Identisch*)
     - `Bitmask` (49-Bit Ganzzahl)
2. **Strukturierter JSON-Bericht**: [`data/symmetry_duplicates.json`](file:///C:/Users/Kessler%20Heinz/.gemini/antigravity-ide/scratch/gerd-muster-explorer/data/symmetry_duplicates.json)
   - Vollständiger Datensatz aller 11.781 Gruppen inklusive 7×7 Matrizen.
3. **Schnellabfrage-Index**: [`data/pattern_symmetry_index.json`](file:///C:/Users/Kessler%20Heinz/.gemini/antigravity-ide/scratch/gerd-muster-explorer/data/pattern_symmetry_index.json)
   - Direkte Zuordnung `Seite_Spalte_Zeile` zur Duplikat-Gruppe.

---

## 🚀 Interaktives Dashboard

Die Web-Anwendung läuft lokal unter:  
👉 **[http://localhost:8089](http://localhost:8089)**

### Enthaltene Funktionen:
* **Duplikat-Explorer**: Durchsuchen aller 11.781 Gruppen mit Filterung nach Symmetrie-Art (90°, 180°, 270°, Spiegelung H/V/Diag) und Seitenzahl.
* **Mustersuche**: Eingabe einer beliebigen Position (`Seite`, `Spalte`, `Zeile`), um sofort alle Duplikate im gesamten Dokument anzuzeigen.
* **Symmetrie-Vergleicher**: Interaktives Tool, das die 8 Transformationen schrittweise visualisiert.
* **Download-Bereich**: Direkter Export der CSV- und JSON-Dateien.

---

## 🛠️ Python-Skripte

* `scripts/find_symmetry_duplicates.py`: Führt den vollständigen 49-Bit Vektor-Scan aller 159 Seiten durch (Laufzeit: ca. 15 Sekunden).
* `scripts/export_duplicates_csv.py`: Generiert die Excel-kompatible CSV-Datei aus dem JSON-Bericht.
