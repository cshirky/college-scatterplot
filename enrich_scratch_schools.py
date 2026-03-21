"""
Enrich scratch_schools.csv with additional columns from IPEDS data.
"""
import pandas as pd
import gzip

RAW = "data/raw"

# Load scratch_schools
scratch = pd.read_csv("scratch_schools.csv", header=None, names=["UNITID", "INSTNM", "slug"])

# Load institutions.csv for columns we already have
inst = pd.read_csv("src/data/institutions.csv", usecols=[
    "UNITID", "admission_rate", "grad_rate_6yr", "enrollment_ug", "yield_rate"
])

# Load SAT percentiles from adm2023
adm = pd.read_csv(f"{RAW}/adm2023.csv", usecols=[
    "UNITID", "SATVR25", "SATVR75", "SATMT25", "SATMT75"
])
# Composite SAT = verbal + math
adm["sat_25"] = adm["SATVR25"].add(adm["SATMT25"])
adm["sat_75"] = adm["SATVR75"].add(adm["SATMT75"])
adm = adm[["UNITID", "sat_25", "sat_75"]]

# Load enrollment FT/PT from drvef2023
ef = pd.read_csv(f"{RAW}/drvef2023.csv", usecols=["UNITID", "EFUG", "EFUGFT", "EFUGPT"])
ef["pct_part_time"] = (ef["EFUGPT"] / ef["EFUG"] * 100).round(1)
ef = ef[["UNITID", "pct_part_time"]]

# Load housing capacity from IC2023_RV; use ROOMCAP / enrollment_ug as proxy for % on campus
ic = pd.read_csv(f"{RAW}/IC2023_RV.csv", usecols=["UNITID", "ROOMCAP"])
ic["ROOMCAP"] = pd.to_numeric(ic["ROOMCAP"], errors="coerce")

# Load completions for associate:bachelor ratio from C2023_a
with gzip.open(f"{RAW}/C2023_a.csv.gz", "rt") as f:
    comp = pd.read_csv(f, usecols=["UNITID", "AWLEVEL", "CTOTALT"])

# AWLEVEL 3 = Associate's, 5 = Bachelor's
assoc = comp[comp["AWLEVEL"] == 3].groupby("UNITID")["CTOTALT"].sum().rename("assoc_degrees")
bach  = comp[comp["AWLEVEL"] == 5].groupby("UNITID")["CTOTALT"].sum().rename("bach_degrees")
degrees = pd.concat([assoc, bach], axis=1).fillna(0)
degrees["assoc_bach_ratio"] = (degrees["assoc_degrees"] / degrees["bach_degrees"].replace(0, float("nan"))).round(3)
degrees = degrees.reset_index()[["UNITID", "assoc_bach_ratio"]]

# Merge everything onto scratch
result = scratch.merge(inst, on="UNITID", how="left")
result = result.merge(adm, on="UNITID", how="left")
result = result.merge(ef, on="UNITID", how="left")
result = result.merge(ic, on="UNITID", how="left")
result = result.merge(degrees, on="UNITID", how="left")

# % living on campus = ROOMCAP / enrollment_ug * 100
result["pct_on_campus"] = (result["ROOMCAP"] / result["enrollment_ug"] * 100).round(1)
result = result.drop(columns=["ROOMCAP"])

# Rename for clarity
result = result.rename(columns={
    "admission_rate": "admission_rate",
    "grad_rate_6yr": "grad_rate_6yr",
    "enrollment_ug": "enrollment_ug",
    "yield_rate": "yield_rate",
    "sat_25": "sat_25pct",
    "sat_75": "sat_75pct",
    "pct_part_time": "pct_part_time",
    "assoc_bach_ratio": "assoc_bach_ratio",
    "pct_on_campus": "pct_on_campus",
})

# Round rates to 1 decimal
for col in ["admission_rate", "grad_rate_6yr", "yield_rate"]:
    result[col] = result[col].round(1)

result.to_csv("scratch_schools_enriched.csv", index=False)
print(f"Written {len(result)} rows to scratch_schools_enriched.csv")
print(result.head(3).to_string())
