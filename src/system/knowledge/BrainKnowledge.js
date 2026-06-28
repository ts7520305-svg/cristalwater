class BrainKnowledge {
  constructor() {
    this.notes = [];
  }

  addNote(title, body, tags = []) {
    const note = {
      id: `know_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      tags,
      createdAt: new Date().toISOString(),
    };

    this.notes.push(note);
    return note;
  }

  listNotes(limit = 50) {
    return this.notes.slice(-limit);
  }
}

module.exports = new BrainKnowledge();
