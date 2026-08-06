const permissionMatrix = {
  leads: {
    write: new Set(["admin", "manager", "sales"]),
    delete: new Set(["admin", "manager"]),
  },
  opportunities: {
    write: new Set(["admin", "manager", "sales"]),
    delete: new Set(["admin", "manager"]),
  },
  customers: {
    write: new Set(["admin", "manager", "sales"]),
    delete: new Set(["admin", "manager"]),
  },
  vessels: {
    write: new Set(["admin", "manager", "sales"]),
    delete: new Set(["admin", "manager"]),
  },
  engines: {
    write: new Set(["admin", "manager", "technician"]),
    delete: new Set(["admin", "manager"]),
  },
  trips: {
    write: new Set(["admin", "manager", "sales"]),
    delete: new Set(["admin", "manager"]),
  },
  maintenance: {
    write: new Set(["admin", "manager", "technician"]),
    delete: new Set(["admin", "manager"]),
  },
};

export function canWriteModule(role, moduleName) {
  return Boolean(
    role &&
      permissionMatrix[moduleName]?.write.has(role)
  );
}

export function canDeleteModule(role, moduleName) {
  return Boolean(
    role &&
      permissionMatrix[moduleName]?.delete.has(role)
  );
}
