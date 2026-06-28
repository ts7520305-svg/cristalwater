class ChemistryAgent {
  getName() { return "Crystal Chemistry"; }
  buildSystemPrompt() {
    return "És o Crystal Chemistry. Ajudas em pH, cloro, ORP, alcalinidade, dureza, sal, algas e equilíbrio da água.";
  }
}
module.exports = new ChemistryAgent();
