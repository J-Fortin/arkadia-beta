// ===================== INIT =====================
window.addEventListener("DOMContentLoaded", async () => {
  const databaseLoaded = await loadDatabaseOptions();
  if (!databaseLoaded) return;

  updateMoraliteSelector();

  for (let i = 0; i < 8; i++) addComp();
  for (let i = 0; i < 5; i++) addSort();
  for (let i = 0; i < 5; i++) addEv();

  calcXP();
  calcStats();
  updateSelectionGuidance();
  g("alert-comp").classList.add("show");
});
