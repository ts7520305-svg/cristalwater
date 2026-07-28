# Mission Status Board

## Global board
- Tecnico: YELLOW
- Administrador: WHITE
- Cliente: WHITE
- Alert Engine: WHITE
- IA: WHITE
- Release: WHITE

---

## Mission KPI policy
Sprint KPI:
- MRI (Mission Ready Index) must be >= 95 to close sprint.

Mission KPI:
- MSI (Mission Stability Index) tracks whole mission stability.

MSI reference inputs:
- Average MRI across sprints
- Regressions count
- Hotfixes count
- Crashes count

Suggested executive format:
- Mission: TECHNICIAN T1
- Average MRI: <value>
- Regressions: <value>
- Hotfixes: <value>
- Crashes: <value>
- MSI: <value>/100

---

## Tag and internal release policy
When a mission is fully closed and frozen:
- Create git tag: TECHNICIAN_T1, ADMIN_T1, CLIENT_T1, ALERT_ENGINE_T1, AI_T1, RC1
- Publish internal release note with the same identifier.
