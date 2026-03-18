"""IPEDS 2023 data pipeline — builds institutions.csv and programs.csv."""

import pandas as pd
from pathlib import Path


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


def _read_csv(path, **kwargs):
    """Read a CSV, trying utf-8-sig first (handles BOM), falling back to latin-1."""
    try:
        return pd.read_csv(path, encoding="utf-8-sig", **kwargs)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="latin-1", **kwargs)


def load_institutions(raw_dir: str) -> pd.DataFrame:
    """Load institutions from HD2023 and filter to 4-year sectors (1, 2, 3)."""
    path = Path(raw_dir) / "HD2023.csv"
    df = _read_csv(path)
    df = df[df["SECTOR"].isin([1, 2, 3])].copy()
    return df


def join_admissions(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join admissions data, adding admission_rate column."""
    path = Path(raw_dir) / "drvadm2023.csv"
    adm = _read_csv(path)
    adm = adm[["UNITID", "DVADM01"]].rename(columns={"DVADM01": "admission_rate"})
    adm["admission_rate"] = pd.to_numeric(adm["admission_rate"], errors="coerce")
    return df.merge(adm, on="UNITID", how="left")


def join_graduation_rates(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join graduation rate data, adding grad_rate_6yr column."""
    path = Path(raw_dir) / "drvgr2023.csv"
    gr = _read_csv(path)
    gr = gr[["UNITID", "BAGR150"]].rename(columns={"BAGR150": "grad_rate_6yr"})
    gr["grad_rate_6yr"] = pd.to_numeric(gr["grad_rate_6yr"], errors="coerce")
    return df.merge(gr, on="UNITID", how="left")


def join_enrollment_demographics(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join enrollment and demographic data from drvef2023."""
    path = Path(raw_dir) / "drvef2023.csv"
    ef = _read_csv(path)
    rename_map = {
        "ENRTOT": "enrollment_total", "EFUG": "enrollment_ug",
        "PCTENRW": "pct_women", "PCTENRWH": "pct_white",
        "PCTENRBK": "pct_black", "PCTENRHS": "pct_hispanic",
        "PCTENRAS": "pct_asian", "PCTENRAN": "pct_aian",
        "PCTENRNH": "pct_nhpi", "PCTENR2M": "pct_two_or_more",
        "PCTENRUN": "pct_unknown", "PCTENRNR": "pct_nonresident",
    }
    cols = ["UNITID"] + list(rename_map.keys())
    ef = ef[cols].rename(columns=rename_map)
    for col in rename_map.values():
        ef[col] = pd.to_numeric(ef[col], errors="coerce")
    return df.merge(ef, on="UNITID", how="left")


def join_pell(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join Pell grant percentage from sfa2223."""
    path = Path(raw_dir) / "sfa2223.csv"
    sfa = _read_csv(path)
    sfa = sfa[["UNITID", "UPGRNTP"]].rename(columns={"UPGRNTP": "pct_pell"})
    sfa["pct_pell"] = pd.to_numeric(sfa["pct_pell"], errors="coerce")
    return df.merge(sfa, on="UNITID", how="left")


def join_tuition(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join tuition data from IC2023_AY."""
    path = Path(raw_dir) / "ic2023_ay.csv"
    if not path.exists():
        path = Path(raw_dir) / "IC2023_AY.csv"
    ic = _read_csv(path)
    ic = ic[["UNITID", "TUITION2", "TUITION3"]].rename(columns={
        "TUITION2": "tuition_in_state",
        "TUITION3": "tuition_out_of_state",
    })
    ic["tuition_in_state"] = pd.to_numeric(ic["tuition_in_state"], errors="coerce")
    ic["tuition_out_of_state"] = pd.to_numeric(ic["tuition_out_of_state"], errors="coerce")
    return df.merge(ic, on="UNITID", how="left")


RELAFFIL_LABELS = {
    22: "American Evangelical Lutheran Church", 24: "African Methodist Episcopal Zion Church",
    27: "Assemblies of God Church", 28: "Brethren Church", 30: "Roman Catholic",
    33: "Wisconsin Evangelical Lutheran Synod", 34: "Christ and Missionary Alliance Church",
    35: "Christian Reformed Church", 37: "Evangelical Covenant Church of America",
    38: "Evangelical Free Church of America", 39: "Evangelical Lutheran Church",
    41: "Free Will Baptist Church", 42: "Interdenominational", 43: "Mennonite Brethren Church",
    44: "Moravian Church", 45: "North American Baptist", 47: "Pentecostal Holiness Church",
    48: "Christian Churches and Churches of Christ", 49: "Reformed Church in America",
    50: "Episcopal Church, Reformed", 51: "African Methodist Episcopal",
    52: "American Baptist", 54: "Baptist", 55: "Christian Methodist Episcopal",
    57: "Church of God", 58: "Church of Brethren", 59: "Church of the Nazarene",
    60: "Cumberland Presbyterian", 61: "Christian Church (Disciples of Christ)",
    64: "Free Methodist", 65: "Friends", 66: "Presbyterian Church (USA)",
    67: "Lutheran Church in America", 68: "Lutheran Church - Missouri Synod",
    69: "Mennonite Church", 71: "United Methodist", 73: "Protestant Episcopal",
    74: "Churches of Christ", 75: "Southern Baptist", 76: "United Church of Christ",
    78: "Multiple Protestant Denomination", 79: "Other Protestant",
    80: "Jewish", 81: "Reformed Presbyterian Church", 84: "United Brethren Church",
    87: "Missionary Church Inc", 88: "Undenominational", 89: "Wesleyan",
    91: "Greek Orthodox", 92: "Russian Orthodox", 93: "Unitarian Universalist",
    94: "The Church of Jesus Christ of Latter-day Saints", 95: "Seventh Day Adventist",
    97: "The Presbyterian Church in America", 99: "Other",
    100: "Original Free Will Baptist", 102: "Evangelical Christian",
    103: "Presbyterian", 105: "General Baptist", 107: "Plymouth Brethren",
    108: "Non-Denominational", 110: "Orthodox Christian",
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


def join_athletics(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join NCAA division, athletic association, and sports offered from EADA 2023."""
    path = Path(raw_dir) / "eada2023_participants.csv"
    if not path.exists():
        return df
    eada = _read_csv(path)
    eada = eada.rename(columns={
        "Classification Name": "ncaa_division",
        "Sanction Name": "athletic_association",
    })
    total_cols = [f"{s} Total Participation" for s in EADA_SPORTS]
    for col in total_cols:
        if col in eada.columns:
            eada[col] = pd.to_numeric(eada[col], errors="coerce").fillna(0)

    def sports_list(row):
        offered = []
        for sport in EADA_SPORTS:
            col = f"{sport} Total Participation"
            if col in eada.columns and row.get(col, 0) > 0:
                offered.append(SPORT_NAME_MAP.get(sport, sport))
        return ", ".join(offered) if offered else None

    eada["sports_offered"] = eada.apply(sports_list, axis=1)
    keep = eada[["UNITID", "ncaa_division", "athletic_association", "sports_offered"]]
    return df.merge(keep, on="UNITID", how="left")


def join_religious_affiliation(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join religious affiliation from IC2023_RV."""
    path = Path(raw_dir) / "IC2023_RV.csv"
    if not path.exists():
        path = Path(raw_dir) / "IC2023.csv"
    if not path.exists():
        return df
    ic = _read_csv(path, usecols=["UNITID", "RELAFFIL"])
    ic["RELAFFIL"] = pd.to_numeric(ic["RELAFFIL"], errors="coerce")
    ic["relaffil_label"] = ic["RELAFFIL"].map(RELAFFIL_LABELS)
    return df.merge(ic[["UNITID", "relaffil_label"]], on="UNITID", how="left")


def join_sat_act(df: pd.DataFrame, raw_dir: str) -> pd.DataFrame:
    """Join SAT/ACT score data and yield rate from ADM2023."""
    path = Path(raw_dir) / "adm2023.csv"
    if not path.exists():
        path = Path(raw_dir) / "ADM2023.csv"
    adm = _read_csv(path)
    wanted = ["UNITID", "SATVR25", "SATVR75", "SATMT25", "SATMT75", "ACTCM25", "ACTCM75", "ADMSSN", "ENRLT"]
    score_cols = [c for c in wanted if c in adm.columns]
    adm = adm[score_cols].copy()
    for col in score_cols[1:]:
        adm[col] = pd.to_numeric(adm[col], errors="coerce")
    if "SATVR25" in adm.columns:
        adm["sat_avg"] = ((adm["SATVR25"] + adm["SATVR75"]) / 2 +
                          (adm["SATMT25"] + adm["SATMT75"]) / 2).round(0)
    if "ACTCM25" in adm.columns:
        adm["act_avg"] = ((adm["ACTCM25"] + adm["ACTCM75"]) / 2).round(1)
    if "ADMSSN" in adm.columns and "ENRLT" in adm.columns:
        adm["yield_rate"] = (adm["ENRLT"] / adm["ADMSSN"] * 100).round(1)
    keep = ["UNITID"] + [c for c in ["sat_avg", "act_avg", "yield_rate"] if c in adm.columns]
    return df.merge(adm[keep], on="UNITID", how="left")


def add_grad_ratio(df: pd.DataFrame) -> pd.DataFrame:
    """Add grad_ratio column: none, minority, or majority."""
    df = df.copy()

    def ratio(row):
        total = row.get("enrollment_total")
        ug = row.get("enrollment_ug")
        if pd.isna(total) or pd.isna(ug):
            return None
        g = total - ug
        if g <= 0:
            return "none"
        elif g < ug:
            return "minority"
        else:
            return "majority"

    df["grad_ratio"] = df.apply(ratio, axis=1)
    return df


def add_labels(df: pd.DataFrame) -> pd.DataFrame:
    """Add human-readable sector and locale labels."""
    df = df.copy()
    sector_map = {1: "Public", 2: "Private nonprofit", 3: "Private for-profit"}
    df["sector_label"] = df["SECTOR"].map(sector_map)

    def locale_group(code):
        if pd.isna(code):
            return "Unknown"
        code = int(code)
        tens = code // 10
        return {1: "City", 2: "Suburb", 3: "Town", 4: "Rural"}.get(tens, "Unknown")

    df["locale_group"] = df["LOCALE"].apply(locale_group)
    return df


def build_programs(raw_dir: str) -> pd.DataFrame:
    """Build programs dataset from completions data, filtered to bachelor's."""
    path = Path(raw_dir) / "C2023_a.csv.gz"
    comp = _read_csv(path, dtype={"CIPCODE": str})
    comp = comp[comp["AWLEVEL"] == 5].copy()
    comp = comp[comp["CIPCODE"] != "99"]
    comp["CTOTALT"] = pd.to_numeric(comp["CTOTALT"], errors="coerce")
    comp = comp.dropna(subset=["CTOTALT"])
    comp["cip_family"] = comp["CIPCODE"].str[:2]
    programs = (
        comp.groupby(["UNITID", "cip_family"])["CTOTALT"]
        .sum().reset_index()
        .rename(columns={"CTOTALT": "total_awards"})
    )
    programs["cip_label"] = programs["cip_family"].map(CIP_FAMILIES).fillna("Other")
    return programs


def main(raw_dir: str = "data/raw", output_dir: str = "data/output"):
    """Build the full IPEDS dataset and write to CSV."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print("Loading institutions from HD2023...")
    df = load_institutions(raw_dir)
    print(f"  {len(df)} 4-year institutions")

    print("Joining admissions data...")
    df = join_admissions(df, raw_dir)

    print("Joining graduation rates...")
    df = join_graduation_rates(df, raw_dir)

    print("Joining enrollment and demographics...")
    df = join_enrollment_demographics(df, raw_dir)

    print("Joining Pell grant data...")
    df = join_pell(df, raw_dir)

    print("Joining tuition data...")
    df = join_tuition(df, raw_dir)

    print("Joining SAT/ACT scores...")
    df = join_sat_act(df, raw_dir)

    print("Joining athletics data...")
    df = join_athletics(df, raw_dir)

    print("Joining religious affiliation...")
    df = join_religious_affiliation(df, raw_dir)

    print("Adding labels...")
    df = add_labels(df)

    print("Adding grad ratio...")
    df = add_grad_ratio(df)

    # Filter out institutions with 0% admission rate or 0% graduation rate
    # (these are data artifacts, not truly zero)
    before = len(df)
    df = df[~((df["admission_rate"] == 0) | (df["grad_rate_6yr"] == 0))].copy()
    print(f"  Filtered out {before - len(df)} institutions with 0% admit or grad rate")

    institutions_cols = [
        "UNITID", "INSTNM", "CITY", "STABBR", "SECTOR", "sector_label",
        "LOCALE", "locale_group", "C18BASIC", "INSTSIZE", "CONTROL", "HBCU",
        "LONGITUD", "LATITUDE", "COUNTYCD",
        "admission_rate", "grad_rate_6yr",
        "enrollment_total", "enrollment_ug",
        "pct_women", "pct_white", "pct_black", "pct_hispanic",
        "pct_asian", "pct_aian", "pct_nhpi", "pct_two_or_more",
        "pct_unknown", "pct_nonresident", "pct_pell",
        "tuition_in_state", "tuition_out_of_state",
        "sat_avg", "act_avg", "yield_rate", "grad_ratio",
        "athletic_association", "ncaa_division", "sports_offered", "relaffil_label",
    ]
    institutions = df[[c for c in institutions_cols if c in df.columns]]
    institutions.to_csv(output_path / "institutions.csv", index=False)
    print(f"Wrote {len(institutions)} rows to institutions.csv")

    print("Building programs dataset...")
    programs = build_programs(raw_dir)
    programs.to_csv(output_path / "programs.csv", index=False)
    print(f"Wrote {len(programs)} rows to programs.csv")
    print("Done.")


if __name__ == "__main__":
    main()
