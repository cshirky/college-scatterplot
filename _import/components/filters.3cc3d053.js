const stateOptions = [
  "AK","AL","AR","AZ","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN",
  "KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ",
  "NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA",
  "WI","WV","WY"
];

export function buildControls(Inputs, good_schools) {
  const localeCounts = {
    "Cities":           good_schools.filter(d => d.locale_group === "City").length,
    "Towns or Suburbs": good_schools.filter(d => d.locale_group === "Town" || d.locale_group === "Suburb").length,
    "Rural":            good_schools.filter(d => d.locale_group === "Rural").length,
  };
  const sizeCounts = {
    "Tiny":      good_schools.filter(d => +d.enrollment_ug < 1000).length,
    "Small":     good_schools.filter(d => +d.enrollment_ug >= 1000  && +d.enrollment_ug < 2500).length,
    "Medium":    good_schools.filter(d => +d.enrollment_ug >= 2500  && +d.enrollment_ug < 10000).length,
    "Large":     good_schools.filter(d => +d.enrollment_ug >= 10000 && +d.enrollment_ug < 25000).length,
    "Very Large":good_schools.filter(d => +d.enrollment_ug >= 25000).length,
  };
  return Inputs.form(
    {
      searchQuery: Inputs.text({placeholder: "Search for a school…", width: 300, label: "Search:"}),
      yieldFloor: Inputs.select([10, 15, 20, 25], {
        label: null,
        format: d => `Exclude schools with < ${d}% yield`,
        value: 10,
        width: 170,
      }),
      gradFloor: Inputs.select([50, 55, 60, 65], {
        label: null,
        format: d => `Exclude schools with < ${d}% grad rate`,
        value: 50,
        width: 185,
      }),
      selectedState: Inputs.select([null, ...stateOptions], {
        label: "Add regionally recruiting schools from state:",
        format: d => d ?? "None",
        value: null,
      }),
      localeFilter: Inputs.checkbox(["Cities", "Towns or Suburbs", "Rural"], {
        label: "Setting:",
        value: ["Cities", "Towns or Suburbs", "Rural"],
        format: d => `${d} (${localeCounts[d]})`,
      }),
      sizeFilter: Inputs.checkbox(["Tiny", "Small", "Medium", "Large", "Very Large"], {
        label: "Undergrad population:",
        value: ["Tiny", "Small", "Medium", "Large", "Very Large"],
        format: d => ({
          "Tiny":      `Tiny (<1,000) (${sizeCounts["Tiny"]})`,
          "Small":     `Small (<2,500) (${sizeCounts["Small"]})`,
          "Medium":    `Medium (<10,000) (${sizeCounts["Medium"]})`,
          "Large":     `Large (<25,000) (${sizeCounts["Large"]})`,
          "Very Large":`Very Large (25,000+) (${sizeCounts["Very Large"]})`,
        })[d],
      }),
    },
    {
      template: inputs => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "border:1px solid #ddd; border-radius:6px; padding:0.75rem 1rem; margin-top:0.5rem; display:flex; flex-direction:column; gap:0.5rem;";
        const row1 = document.createElement("div");
        row1.style.cssText = "display:flex; gap:1rem;";
        row1.append(inputs.yieldFloor, inputs.gradFloor);
        wrap.append(inputs.searchQuery, row1, inputs.selectedState, inputs.localeFilter, inputs.sizeFilter);
        return wrap;
      }
    }
  );
}

export function filterData(good_schools, controls) {
  const {yieldFloor, gradFloor} = controls;
  const localeGroups = new Set([
    ...(controls.localeFilter.includes("Cities") ? ["City"] : []),
    ...(controls.localeFilter.includes("Towns or Suburbs") ? ["Town", "Suburb"] : []),
    ...(controls.localeFilter.includes("Rural") ? ["Rural"] : []),
  ]);

  return good_schools
    .filter(d => {
      if (d.instate_only === "true" && d.primary_recruit_state !== controls.selectedState) return false;
      if (!localeGroups.has(d.locale_group)) return false;
      const ug = d.enrollment_ug;
      const sizeLabel = ug < 1000 ? "Tiny" : ug < 2500 ? "Small" : ug < 10000 ? "Medium" : ug < 25000 ? "Large" : "Very Large";
      if (!controls.sizeFilter.includes(sizeLabel)) return false;
      return true;
    })
    .filter(d => d.grad_rate_6yr != null && d.yield_rate != null &&
                 !isNaN(+d.grad_rate_6yr) && !isNaN(+d.yield_rate))
    .filter(d => {
      const y = Math.round(+d.yield_rate);
      const g = +d.grad_rate_6yr;
      if (y < yieldFloor) return false;
      if (g < gradFloor) return false;
      return true;
    })
    .map(d => ({
      ...d,
      yield_rate:    Math.round(+d.yield_rate),
      grad_rate_6yr: +d.grad_rate_6yr,
    }));
}
