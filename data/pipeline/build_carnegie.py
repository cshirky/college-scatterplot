"""Carnegie 2025 data pipeline — builds institutions.csv and programs.csv.

Uses Carnegie 2025 Public Data File and SAEC file as primary sources,
supplemented by IPEDS 2023 data for enrollment, test scores, tuition, etc.
No third-party dependencies — Python stdlib only.
"""

import csv
import gzip
import io
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


# ── xlsx helpers ─────────────────────────────────────────────────────────────

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def _col_idx(letters):
    """Convert Excel column letters to 0-based index. A→0, B→1, Z→25, AA→26."""
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


def _parse_shared_strings(zf):
    with zf.open("xl/sharedStrings.xml") as f:
        tree = ET.parse(f)
    strings = []
    for si in tree.findall(f".//{{{NS}}}si"):
        text = "".join(t.text or "" for t in si.iter() if t.tag.endswith("}t"))
        strings.append(text)
    return strings


def _sheet_file_for_name(zf, sheet_name):
    """Return the worksheet filename (e.g. 'xl/worksheets/sheet2.xml') for a named sheet."""
    with zf.open("xl/workbook.xml") as f:
        wb = ET.parse(f)
    with zf.open("xl/_rels/workbook.xml.rels") as f:
        rels_tree = ET.parse(f)

    rels = {}
    for rel in rels_tree.findall(".//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
        rels[rel.get("Id")] = rel.get("Target")

    for sheet in wb.findall(f".//{{{NS}}}sheet"):
        if sheet.get("name") == sheet_name:
            rid = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rels.get(rid, "")
            return f"xl/{target}" if not target.startswith("xl/") else target
    return None


def read_xlsx(path, sheet_name=None, sheet_file=None):
    """Read an xlsx sheet into a list of dicts keyed by the header row.

    Specify sheet_name OR sheet_file (path inside zip, e.g. 'xl/worksheets/sheet2.xml').
    """
    zf = zipfile.ZipFile(path)
    strings = _parse_shared_strings(zf)

    if sheet_file is None:
        if sheet_name:
            sheet_file = _sheet_file_for_name(zf, sheet_name)
        if not sheet_file:
            # Default to first sheet
            sheet_file = "xl/worksheets/sheet1.xml"

    with zf.open(sheet_file) as f:
        tree = ET.parse(f)

    rows_el = tree.findall(f".//{{{NS}}}row")

    def get_row_dict(row_el):
        d = {}
        for c in row_el.findall(f"{{{NS}}}c"):
            addr = c.get("r", "")
            m = re.match(r"^([A-Z]+)", addr)
            if not m:
                continue
            col = _col_idx(m.group(1))
            t = c.get("t")
            v = c.find(f"{{{NS}}}v")
            if v is not None and v.text is not None:
                d[col] = strings[int(v.text)] if t == "s" else v.text
            else:
                d[col] = ""
        return d

    if not rows_el:
        return []

    header_d = get_row_dict(rows_el[0])
    max_col = max(header_d.keys()) if header_d else 0
    headers = [header_d.get(i, "") for i in range(max_col + 1)]

    result = []
    for row_el in rows_el[1:]:
        d = get_row_dict(row_el)
        row = {headers[i]: d.get(i, "") for i in range(max_col + 1) if headers[i]}
        result.append(row)
    return result


# ── CSV helpers ───────────────────────────────────────────────────────────────

def _read_csv(path, key=None, encoding="utf-8-sig"):
    """Read a CSV file. If key is given, return dict keyed by that column."""
    try:
        with open(path, encoding=encoding, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except UnicodeDecodeError:
        with open(path, encoding="latin-1", newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    if key:
        return {str(r[key]).strip(): r for r in rows if r.get(key)}
    return rows


def _read_gz_csv(path, key=None):
    """Read a gzipped CSV file."""
    try:
        with gzip.open(path, "rt", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except UnicodeDecodeError:
        with gzip.open(path, "rt", encoding="latin-1") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    if key:
        return {str(r[key]).strip(): r for r in rows if r.get(key)}
    return rows


def _num(val, default=None):
    """Parse a numeric string, returning default on failure."""
    if val is None or str(val).strip() in ("", ".", "PrivacySuppressed"):
        return default
    try:
        return float(str(val).replace(",", ""))
    except ValueError:
        return default


# ── download helper ───────────────────────────────────────────────────────────

def download_and_unzip(url, raw_dir, zip_name):
    """Download a zip from url into raw_dir and unzip it. Skip if already present."""
    zip_path = Path(raw_dir) / zip_name
    if not zip_path.exists():
        print(f"  Downloading {zip_name}...")
        try:
            urllib.request.urlretrieve(url, zip_path)
        except Exception as e:
            print(f"  Warning: could not download {zip_name}: {e}")
            return False
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(raw_dir)
    return True


# ── setting2025 labels ────────────────────────────────────────────────────────

SETTING_LABELS = {
    "1": "Highly residential",
    "2": "Primarily residential",
    "3": "Residential",
    "4": "Primarily non-residential",
    "5": "Primarily online",
    "6": "Online and on-campus",
    "7": "Mostly full-time, not residential",
    "8": "Mostly part-time, not residential",
    "9": "Graduate-focused",
}

CONTROL_LABELS = {
    "1": "Public",
    "2": "Private nonprofit",
    "3": "Private for-profit",
}

HIGHEST_DEG_LABELS = {
    "1": "Associate",
    "2": "Bachelor's",
    "3": "Master's",
    "4": "Doctorate",
}

SIZE_LABELS = {
    "1": "Very Small",
    "2": "Small",
    "3": "Medium",
    "4": "Large",
    "5": "Very Large",
}

STATE_ABBREVS = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
    "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME",
    "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
    "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
    "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
    "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
    "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
    "Puerto Rico": "PR", "Guam": "GU", "American Samoa": "AS",
    "Virgin Islands": "VI", "Northern Marianas": "MP", "Marshall Islands": "MH",
    "Micronesia": "FM", "Palau": "PW",
}


# ── CIP programs ─────────────────────────────────────────────────────────────

CIP_FAMILIES = {
    "01": "Agriculture", "03": "Natural Resources", "04": "Architecture",
    "05": "Area/Ethnic Studies", "09": "Communication", "10": "Communications Tech",
    "11": "Computer Science", "12": "Personal/Culinary", "13": "Education",
    "14": "Engineering", "15": "Engineering Tech", "16": "Foreign Languages",
    "19": "Family/Consumer Sciences", "22": "Legal Professions",
    "23": "English", "24": "Liberal Arts", "25": "Library Science",
    "26": "Biological Sciences", "27": "Mathematics", "29": "Military Tech",
    "30": "Interdisciplinary", "31": "Parks/Recreation",
    "38": "Philosophy/Religion", "39": "Theology",
    "40": "Physical Sciences", "41": "Science Tech",
    "42": "Psychology", "43": "Homeland Security",
    "44": "Public Administration", "45": "Social Sciences",
    "46": "Construction Trades", "47": "Mechanic/Repair",
    "48": "Precision Production", "49": "Transportation",
    "50": "Visual/Performing Arts", "51": "Health Professions",
    "52": "Business", "54": "History",
}

RELAFFIL_LABELS = {
    "22": "American Evangelical Lutheran Church", "24": "African Methodist Episcopal Zion",
    "27": "Assemblies of God", "28": "Brethren", "30": "Roman Catholic",
    "33": "Wisconsin Evangelical Lutheran Synod", "34": "Christian and Missionary Alliance",
    "35": "Christian Reformed", "37": "Evangelical Covenant",
    "38": "Evangelical Free Church", "39": "Evangelical Lutheran",
    "41": "Free Will Baptist", "42": "Interdenominational", "43": "Mennonite Brethren",
    "44": "Moravian", "45": "North American Baptist", "47": "Pentecostal Holiness",
    "48": "Christian Churches and Churches of Christ", "49": "Reformed Church in America",
    "50": "Episcopal Church, Reformed", "51": "African Methodist Episcopal",
    "52": "American Baptist", "54": "Baptist", "55": "Christian Methodist Episcopal",
    "57": "Church of God", "58": "Church of Brethren", "59": "Church of the Nazarene",
    "60": "Cumberland Presbyterian", "61": "Christian Church (Disciples of Christ)",
    "64": "Free Methodist", "65": "Friends", "66": "Presbyterian Church (USA)",
    "67": "Lutheran Church in America", "68": "Lutheran Church - Missouri Synod",
    "69": "Mennonite", "71": "United Methodist", "73": "Protestant Episcopal",
    "74": "Churches of Christ", "75": "Southern Baptist", "76": "United Church of Christ",
    "78": "Multiple Protestant", "79": "Other Protestant",
    "80": "Jewish", "81": "Reformed Presbyterian", "84": "United Brethren",
    "87": "Missionary Church", "88": "Undenominational", "89": "Wesleyan",
    "91": "Greek Orthodox", "92": "Russian Orthodox", "93": "Unitarian Universalist",
    "94": "Church of Jesus Christ of Latter-day Saints", "95": "Seventh Day Adventist",
    "97": "Presbyterian Church in America", "99": "Other",
    "100": "Original Free Will Baptist", "102": "Evangelical Christian",
    "103": "Presbyterian", "105": "General Baptist", "107": "Plymouth Brethren",
    "108": "Non-Denominational", "110": "Orthodox Christian",
}

EADA_SPORTS = [
    "Archery", "Badminton", "Baseball", "Basketball", "Beach Volleyball",
    "Bowling", "All Track Combined", "Diving", "Equestrian", "Fencing",
    "Field Hockey", "Football", "Golf", "Gymnastics", "Ice Hockey",
    "Lacrosse", "Rifle", "Rodeo", "Rowing", "Sailing", "Skiing", "Soccer",
    "Softball", "Squash", "Swimming and Diving", "Swimming",
    "Synchronized Swimming", "Table Tennis", "Team Handball", "Tennis",
    "Track and Field Indoor", "Track and Field Outdoor", "Track and Field X Country",
    "Volleyball", "Water Polo", "Weight Lifting", "Wrestling",
]
SPORT_NAME_MAP = {"All Track Combined": "Track & Field"}


# ── main pipeline ─────────────────────────────────────────────────────────────

def main(
    carnegie_dir: str = ".",
    raw_dir: str = "data/raw",
    output_dir: str = "data/output",
):
    raw = Path(raw_dir)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # ── 1. Try to download HD2024 for updated institution info ────────────────
    hd2024_path = raw / "HD2024.csv"
    if not hd2024_path.exists():
        download_and_unzip(
            "https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip",
            raw,
            "HD2024.zip",
        )

    # ── 2. Load Carnegie 2025 Public Data file ───────────────────────────────
    carnegie_path = Path(carnegie_dir) / "2025-Public-Data-File.xlsx"
    print(f"Reading Carnegie 2025 Public Data from {carnegie_path}...")
    carnegie_rows = read_xlsx(carnegie_path, sheet_name="data")
    print(f"  {len(carnegie_rows)} institutions")
    carnegie = {str(r["unitid"]).strip(): r for r in carnegie_rows if r.get("unitid")}

    # ── 3. Load Carnegie SAEC file ────────────────────────────────────────────
    saec_path = Path(carnegie_dir) / "2025-SAEC-Public-Data-File.xlsx"
    print(f"Reading Carnegie SAEC data from {saec_path}...")
    saec_rows = read_xlsx(saec_path, sheet_name=None, sheet_file="xl/worksheets/sheet1.xml")
    print(f"  {len(saec_rows)} institutions")
    saec = {str(r["UnitID"]).strip(): r for r in saec_rows if r.get("UnitID")}

    # ── 4. Load IPEDS supplemental files ─────────────────────────────────────

    # Institution directory (2024 preferred, 2023 fallback)
    hd = {}
    if hd2024_path.exists():
        print("Loading HD2024...")
        hd = _read_csv(hd2024_path, key="UNITID")
    elif (raw / "HD2023.csv").exists():
        print("Loading HD2023 (HD2024 not available)...")
        hd = _read_csv(raw / "HD2023.csv", key="UNITID")

    # Graduation rates
    gr = {}
    if (raw / "drvgr2023.csv").exists():
        print("Loading DRVGR2023...")
        gr = _read_csv(raw / "drvgr2023.csv", key="UNITID")

    # Enrollment & demographics
    ef = {}
    if (raw / "drvef2023.csv").exists():
        print("Loading DRVEF2023...")
        ef = _read_csv(raw / "drvef2023.csv", key="UNITID")

    # Tuition
    ic_ay = {}
    for fname in ("ic2023_ay.csv", "IC2023_AY.csv"):
        if (raw / fname).exists():
            print(f"Loading {fname}...")
            ic_ay = _read_csv(raw / fname, key="UNITID")
            break

    # SAT/ACT, yield
    adm = {}
    for fname in ("adm2023.csv", "ADM2023.csv"):
        if (raw / fname).exists():
            print(f"Loading {fname}...")
            adm = _read_csv(raw / fname, key="UNITID")
            break

    # Religious affiliation
    relaffil = {}
    for fname in ("IC2023_RV.csv", "IC2023.csv"):
        if (raw / fname).exists():
            print(f"Loading {fname}...")
            relaffil = _read_csv(raw / fname, key="UNITID")
            break

    # Athletics
    eada = {}
    if (raw / "eada2023_participants.csv").exists():
        print("Loading EADA2023...")
        for row in _read_csv(raw / "eada2023_participants.csv"):
            uid = str(row.get("UNITID", "")).strip()
            if uid:
                eada[uid] = row

    # ── 4b. Load IPEDS admission rate for fallback ────────────────────────────
    ipeds_adm_rate = {}
    if (raw / "drvadm2023.csv").exists():
        print("Loading DRVADM2023 (admission rate fallback)...")
        for r in _read_csv(raw / "drvadm2023.csv"):
            uid2 = str(r.get("UNITID", "")).strip()
            val = _num(r.get("DVADM01"))
            if uid2 and val is not None:
                ipeds_adm_rate[uid2] = val

    # ── 5. Build output rows ──────────────────────────────────────────────────
    print("Building institutions dataset...")
    out_rows = []

    for uid, c in carnegie.items():
        row = {}

        # ── identifiers and Carnegie classifications ──────────────────────────
        row["UNITID"] = uid
        row["INSTNM"] = c.get("instnm", "")
        row["CITY"] = c.get("city", "")
        # Normalize state: prefer IPEDS 2-letter abbreviation from HD, fall back to Carnegie name→abbrev
        hd_row_early = hd.get(uid, {})
        if hd_row_early.get("STABBR"):
            row["STABBR"] = hd_row_early["STABBR"].strip()
        else:
            full_name = c.get("stabbr", "")
            row["STABBR"] = STATE_ABBREVS.get(full_name, full_name)

        row["ic2025"] = c.get("ic2025", "")
        row["ic2025name"] = c.get("ic2025name", "")
        row["saec2025"] = c.get("saec2025", "")
        row["saec2025name"] = c.get("saec2025name", "")
        row["research2025"] = c.get("research2025", "")
        row["research2025name"] = c.get("research2025name", "")
        row["basic2021"] = c.get("basic2021", "")

        ctrl = str(c.get("control", "")).strip()
        row["control"] = ctrl
        row["sector_label"] = CONTROL_LABELS.get(ctrl, "")

        s = str(c.get("setting2025", "")).strip()
        row["setting2025"] = s
        row["setting2025name"] = SETTING_LABELS.get(s, "")

        sz = str(c.get("ic2025size", "")).strip()
        row["ic2025size"] = sz
        row["size_label"] = SIZE_LABELS.get(sz, "")

        hd_deg = str(c.get("highest_degree_2025", "")).strip()
        row["highest_degree_2025"] = HIGHEST_DEG_LABELS.get(hd_deg, "")

        # Special designations (1=yes, 0=no)
        for flag in ("hbcu", "pbi", "annhsi", "tribal", "aanapisi", "hsi",
                     "nasnti", "landgrant", "womenonly", "medical", "rpu"):
            row[flag] = c.get(flag, "0")

        # ── Carnegie earnings & equity metrics ────────────────────────────────
        row["saec_earnings"] = _num(c.get("saec_earnings"))
        row["saec_compearn"] = _num(c.get("saec_compearn"))
        row["earnings_ratio"] = _num(c.get("earnings_ratio"))
        row["pell_2023"] = _num(c.get("pell_2023"))
        row["pell_ratio"] = _num(c.get("pell_ratio"))
        row["saec_urm_ratio"] = _num(c.get("saec_urm_ratio"))
        row["access_ratio"] = _num(c.get("access_ratio"))

        # Carnegie demographic percentages (from SAEC calculation)
        row["saec_pct_urm"] = _num(c.get("saec_urm_2023"))
        for grp in ("asian", "aina", "black", "hispanic", "nhpi", "white", "two_or_more"):
            row[f"saec_pct_{grp}"] = _num(c.get(f"saec_{grp}_2023"))

        # ── College Scorecard / IPEDS outcome metrics ─────────────────────────
        # 8-year outcomes (from Carnegie file, College Scorecard source)
        # OMAWDP8 = 8-year award rate (completion, 0-1 decimal)
        # OMENRYP = % still enrolled at 8yr without degree (0-1 decimal)
        # OMENRAP = % transferred out within 8yr without degree (0-1 decimal)
        omawdp8 = _num(c.get("OMAWDP8_ALL_POOLED_SUPP"))
        row["completion_rate_8yr"] = round(omawdp8 * 100, 1) if omawdp8 is not None else None
        omenryp = _num(c.get("OMENRYP_ALL_POOLED_SUPP"))
        row["still_enrolled_8yr"] = round(omenryp * 100, 1) if omenryp is not None else None
        omenrap = _num(c.get("OMENRAP_ALL_POOLED_SUPP"))
        row["transfer_out_8yr"] = round(omenrap * 100, 1) if omenrap is not None else None
        row["net_price_pub"] = _num(c.get("NPT4_PUB"))
        row["net_price_priv"] = _num(c.get("NPT4_PRIV"))
        row["net_price"] = row["net_price_pub"] if row["net_price_pub"] is not None else row["net_price_priv"]
        row["grad_debt_median"] = _num(c.get("GRAD_DEBT_MDN_SUPP"))
        row["pct_federal_loan"] = _num(c.get("PCTFLOAN_DCS_POOLED_SUPP"))

        # Research expenditure (HERD average)
        row["herd_avg"] = _num(c.get("herd_avg"))

        # ── SAEC file supplement ──────────────────────────────────────────────
        s_row = saec.get(uid, {})
        row["cbsa_name"] = s_row.get("CBSA_Name", "")
        row["pell_pct_saec"] = _num(s_row.get("Pell_PCT"))
        row["urm_pct_saec"] = _num(s_row.get("UnderRepMinority_PCT_22_23"))
        # Primary state of origin (where most students come from)
        row["primary_recruit_state"] = s_row.get("State1_Name_20_21_22", "")
        row["primary_recruit_pct"] = _num(s_row.get("State1_PCT_20_21_22"))

        # ── IPEDS: institution directory ──────────────────────────────────────
        hd_row = hd_row_early  # already looked up above
        if hd_row.get("CITY"):
            row["CITY"] = hd_row["CITY"].strip()
        row["LONGITUD"] = _num(hd_row.get("LONGITUD"))
        row["LATITUDE"] = _num(hd_row.get("LATITUDE"))
        row["WEBADDR"] = hd_row.get("WEBADDR", "")
        row["COUNTYCD"] = hd_row.get("COUNTYCD", "")

        # IPEDS locale → geographic group (City / Suburb / Town / Rural)
        locale_code = hd_row.get("LOCALE", "")
        try:
            tens = int(str(locale_code).strip()) // 10
            row["locale_group"] = {1: "City", 2: "Suburb", 3: "Town", 4: "Rural"}.get(tens, "")
        except (ValueError, TypeError):
            row["locale_group"] = ""

        # ── IPEDS: 6-year graduation rate ─────────────────────────────────────
        gr_row = gr.get(uid, {})
        row["grad_rate_6yr"] = _num(gr_row.get("BAGR150"))

        # ── IPEDS: enrollment & demographics ─────────────────────────────────
        ef_row = ef.get(uid, {})
        enr_total = _num(ef_row.get("ENRTOT"))
        enr_ug = _num(ef_row.get("EFUG"))
        row["enrollment_total"] = enr_total
        row["enrollment_ug"] = enr_ug
        row["pct_women"] = _num(ef_row.get("PCTENRW"))
        row["pct_white"] = _num(ef_row.get("PCTENRWH"))
        row["pct_black"] = _num(ef_row.get("PCTENRBK"))
        row["pct_hispanic"] = _num(ef_row.get("PCTENRHS"))
        row["pct_asian"] = _num(ef_row.get("PCTENRAS"))
        row["pct_aian"] = _num(ef_row.get("PCTENRAN"))
        row["pct_nhpi"] = _num(ef_row.get("PCTENRNH"))
        row["pct_two_or_more"] = _num(ef_row.get("PCTENR2M"))
        row["pct_unknown"] = _num(ef_row.get("PCTENRUN"))
        row["pct_nonresident"] = _num(ef_row.get("PCTENRNR"))

        # ── IPEDS: grad ratio ─────────────────────────────────────────────────
        if enr_total is not None and enr_ug is not None:
            g = enr_total - enr_ug
            if g <= 0:
                row["grad_ratio"] = "none"
            elif g < enr_ug:
                row["grad_ratio"] = "minority"
            else:
                row["grad_ratio"] = "majority"
        else:
            row["grad_ratio"] = ""

        # ── IPEDS: tuition ────────────────────────────────────────────────────
        ic_row = ic_ay.get(uid, {})
        row["tuition_in_state"] = _num(ic_row.get("TUITION2"))
        row["tuition_out_of_state"] = _num(ic_row.get("TUITION3"))

        # ── IPEDS: SAT / ACT / yield ──────────────────────────────────────────
        adm_row = adm.get(uid, {})
        sv25 = _num(adm_row.get("SATVR25"))
        sv75 = _num(adm_row.get("SATVR75"))
        sm25 = _num(adm_row.get("SATMT25"))
        sm75 = _num(adm_row.get("SATMT75"))
        ac25 = _num(adm_row.get("ACTCM25"))
        ac75 = _num(adm_row.get("ACTCM75"))
        admssn = _num(adm_row.get("ADMSSN"))
        enrlt = _num(adm_row.get("ENRLT"))

        if sv25 is not None and sv75 is not None and sm25 is not None and sm75 is not None:
            row["sat_avg"] = round((sv25 + sv75) / 2 + (sm25 + sm75) / 2)
        else:
            row["sat_avg"] = None
        if ac25 is not None and ac75 is not None:
            row["act_avg"] = round((ac25 + ac75) / 2, 1)
        else:
            row["act_avg"] = None
        if admssn and enrlt and admssn > 0:
            row["yield_rate"] = round(enrlt / admssn * 100, 1)
        else:
            row["yield_rate"] = None

        # ── IPEDS admission rate (0-100 percentage scale) ─────────────────────
        row["admission_rate"] = ipeds_adm_rate.get(uid)

        # ── IPEDS: academic tier ──────────────────────────────────────────────
        sat = row["sat_avg"]
        act = row["act_avg"]
        adm_r = row["admission_rate"]
        if sat is not None:
            if sat >= 1400:   tier = "straight-a"
            elif sat >= 1200: tier = "a-range"
            elif sat >= 1050: tier = "b-plus"
            elif sat >= 900:  tier = "b-range"
            else:             tier = None
        elif act is not None:
            if act >= 33:   tier = "straight-a"
            elif act >= 28: tier = "a-range"
            elif act >= 24: tier = "b-plus"
            elif act >= 20: tier = "b-range"
            else:           tier = None
        elif adm_r is not None:
            if adm_r < 15:   tier = "straight-a"
            elif adm_r < 35: tier = "a-range"
            elif adm_r < 55: tier = "b-plus"
            elif adm_r < 75: tier = "b-range"
            else:             tier = None
        else:
            tier = None
        row["academic_tier"] = tier or ""

        # ── IPEDS: religious affiliation ──────────────────────────────────────
        rel_row = relaffil.get(uid, {})
        rel_code = str(rel_row.get("RELAFFIL", "")).strip()
        row["relaffil_label"] = RELAFFIL_LABELS.get(rel_code, "")

        # ── EADA: athletics ───────────────────────────────────────────────────
        e_row = eada.get(uid, {})
        row["ncaa_division"] = e_row.get("Classification Name", "")
        row["athletic_association"] = e_row.get("Sanction Name", "")
        if e_row:
            sports = []
            for sport in EADA_SPORTS:
                col = f"{sport} Total Participation"
                if _num(e_row.get(col), 0) > 0:
                    sports.append(SPORT_NAME_MAP.get(sport, sport))
            row["sports_offered"] = ", ".join(sports) if sports else ""
        else:
            row["sports_offered"] = ""

        out_rows.append(row)

    print(f"  Built {len(out_rows)} institution rows")

    # ── 7. Write institutions.csv ─────────────────────────────────────────────
    institutions_cols = [
        "UNITID", "INSTNM", "CITY", "STABBR",
        "ic2025", "ic2025name", "saec2025", "saec2025name",
        "research2025", "research2025name", "basic2021",
        "control", "sector_label",
        "setting2025", "setting2025name",
        "ic2025size", "size_label", "highest_degree_2025",
        "hbcu", "hsi", "tribal", "womenonly", "landgrant",
        "pbi", "annhsi", "aanapisi", "nasnti", "medical", "rpu",
        "LONGITUD", "LATITUDE", "WEBADDR", "COUNTYCD", "cbsa_name",
        "locale_group",
        "admission_rate", "grad_rate_6yr",
        "completion_rate_8yr", "still_enrolled_8yr", "transfer_out_8yr",
        "enrollment_total", "enrollment_ug",
        "pct_women", "pct_white", "pct_black", "pct_hispanic",
        "pct_asian", "pct_aian", "pct_nhpi", "pct_two_or_more",
        "pct_unknown", "pct_nonresident",
        "pell_2023", "pell_ratio",
        "saec_earnings", "saec_compearn", "earnings_ratio",
        "saec_urm_ratio", "access_ratio",
        "saec_pct_urm", "saec_pct_black", "saec_pct_hispanic",
        "saec_pct_asian", "saec_pct_white",
        "net_price", "net_price_pub", "net_price_priv",
        "tuition_in_state", "tuition_out_of_state",
        "grad_debt_median", "pct_federal_loan",
        "herd_avg",
        "sat_avg", "act_avg", "yield_rate",
        "grad_ratio", "academic_tier",
        "athletic_association", "ncaa_division", "sports_offered",
        "relaffil_label",
        "primary_recruit_state", "primary_recruit_pct",
    ]

    inst_path = out / "institutions.csv"
    with open(inst_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=institutions_cols, extrasaction="ignore")
        writer.writeheader()
        for row in out_rows:
            writer.writerow({k: ("" if row.get(k) is None else row[k]) for k in institutions_cols})
    print(f"Wrote {len(out_rows)} rows to {inst_path}")

    # ── 8. Build programs.csv from IPEDS completions ──────────────────────────
    print("Building programs dataset...")
    comp_path = raw / "C2023_a.csv.gz"
    if not comp_path.exists():
        print("  C2023_a.csv.gz not found, skipping programs.")
    else:
        prog_counts = {}  # {(unitid, cip_family): count}
        rows_read = 0
        for r in _read_gz_csv(comp_path):
            if r.get("AWLEVEL") != "5":
                continue
            cipcode = str(r.get("CIPCODE", ""))
            if cipcode == "99":
                continue
            total = _num(r.get("CTOTALT"))
            if total is None:
                continue
            uid = str(r.get("UNITID", "")).strip()
            cip2 = cipcode[:2].zfill(2)
            key = (uid, cip2)
            prog_counts[key] = prog_counts.get(key, 0) + total
            rows_read += 1

        prog_rows = []
        for (uid, cip2), total in sorted(prog_counts.items()):
            prog_rows.append({
                "UNITID": uid,
                "cip_family": cip2,
                "total_awards": total,
                "cip_label": CIP_FAMILIES.get(cip2, "Other"),
            })

        prog_path = out / "programs.csv"
        with open(prog_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["UNITID", "cip_family", "total_awards", "cip_label"])
            writer.writeheader()
            writer.writerows(prog_rows)
        print(f"Wrote {len(prog_rows)} rows to {prog_path}")

    print("Done.")


if __name__ == "__main__":
    import sys
    # Default: run from project root
    # Carnegie files are in project root, IPEDS raw in data/raw/
    project_root = Path(__file__).parent.parent.parent
    carnegie_dir = str(project_root)
    raw_dir = str(project_root / "data" / "raw")
    output_dir = str(project_root / "data" / "output")

    # Also copy outputs to src/data/
    main(carnegie_dir=carnegie_dir, raw_dir=raw_dir, output_dir=output_dir)

    src_data = project_root / "src" / "data"
    import shutil
    for fname in ("institutions.csv", "programs.csv"):
        src = project_root / "data" / "output" / fname
        dst = src_data / fname
        if src.exists():
            shutil.copy2(src, dst)
            print(f"Copied {fname} to src/data/")
