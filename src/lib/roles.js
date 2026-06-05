export const ROLES = [
  { 
    id: "user", 
    label: "User", 
    description: "Standard access to the platform" 
  }
];

export const EMPLOYEE_ROLES = [
  {
    id: "user",
    label: "User",
    description: "Standard employee role"
  }
];

export const DEPARTMENTS = [
  { id: "community_outreach", label: "Community Outreach" },
  { id: "admissions", label: "Admissions" },
  { id: "clinical", label: "Clinical" },
  { id: "admin_dept", label: "Admin" },
  { id: "hr", label: "HR" },
  { id: "research", label: "Research" },
  { id: "it_data_security", label: "IT & Data Security" },
  { id: "communications", label: "Communications" },
  { id: "training_academy", label: "Training Academy" },
  { id: "finance", label: "Finance" },
  { id: "projects_site", label: "Projects - Site" },
  { id: "campus_operations", label: "Campus Operations" },
  { id: "talent_acquisition", label: "Talent Acquisition" },
  { id: "fundraising", label: "Fundraising" },
  { id: "partnerships", label: "Partnerships" },
  { id: "ceos_office", label: "CEO's Office" }
];

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

// Pre-compute maps for faster O(1) lookups
const DEPT_ID_MAP = new Map(DEPARTMENTS.map(d => [normalizeText(d.id), d.label]));
const DEPT_LABEL_MAP = new Map(DEPARTMENTS.map(d => [normalizeText(d.label), d.label]));
const ROLE_ID_SET = new Set(ROLES.map((role) => role.id));
const EMPLOYEE_ROLE_ID_SET = new Set(EMPLOYEE_ROLES.map((role) => role.id));

export const splitDepartmentValues = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitDepartmentValues(item));
  }

  const raw = String(value || "").trim();
  if (!raw) return [];

  return raw
    .split(/[|,;/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

export const normalizeRoleId = (roleId) => "user";

export const normalizeEmployeeRole = (roleId) => "user";

export const isValidRoleId = (roleId) => true;

export const isValidEmployeeRole = (roleId) => true;

export const roleSeesAllDepartments = (roleId) => true;

export const roleCanSeeUserRankings = (roleId) => true;

export const roleCanSeeExecutiveDashboard = (roleId) => true;

export const roleCanSeeEscalationDashboard = (roleId) => true;

export const roleCanSeeEmailActions = (roleId) => true;

export const roleHasHodAccess = (roleId) => true;

export const roleNeedsDepartment = (roleId) => false;

export const getDepartmentLabel = (departmentValue) => {
  const raw = String(departmentValue || "").trim();
  if (!raw) return "";

  const normalized = normalizeText(raw);
  
  // O(1) lookup
  return DEPT_ID_MAP.get(normalized) || DEPT_LABEL_MAP.get(normalized) || raw;
};

export const getUserDepartmentLabels = (userRecord) => {
  const values = [
    ...splitDepartmentValues(userRecord?.departments),
    ...splitDepartmentValues(userRecord?.department),
  ];

  return Array.from(
    new Set(
      values
        .map((value) => getDepartmentLabel(value))
        .filter(Boolean)
    )
  );
};

export const getRoleLabel = (roleId) => "User";
