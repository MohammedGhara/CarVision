// apps/mobile/constants/forumCategories.js
/** Mirror apps/server/src/routes/forum.js CATEGORIES for validation & chips */
export const FORUM_CATEGORIES = [
  "Engine",
  "Battery",
  "Tires",
  "Brakes",
  "Transmission",
  "Cooling System",
  "Fuel System",
  "Electrical",
  "OBD-II / DTC Codes",
  "Maintenance",
  "General Question",
];

/** Map API category string → i18n key under forum.cat_* */
export function forumCategoryKey(cat) {
  const map = {
    Engine: "cat_engine",
    Battery: "cat_battery",
    Tires: "cat_tires",
    Brakes: "cat_brakes",
    Transmission: "cat_transmission",
    "Cooling System": "cat_cooling",
    "Fuel System": "cat_fuel",
    Electrical: "cat_electrical",
    "OBD-II / DTC Codes": "cat_obd",
    Maintenance: "cat_maintenance",
    "General Question": "cat_general",
  };
  return map[cat] || "cat_general";
}

export const FORUM_SORT_KEYS = ["newest", "helpful", "unanswered", "solved"];
