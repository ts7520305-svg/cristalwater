class StateMachine {
  constructor({ initialState, transitions = {} } = {}) {
    if (!initialState) throw new Error("StateMachine: initialState obrigatório.");

    this.state = initialState;
    this.transitions = transitions;
    this.history = [
      {
        state: initialState,
        at: new Date().toISOString(),
        reason: "initial",
      },
    ];
  }

  can(nextState) {
    const allowed = this.transitions[this.state] || [];
    return allowed.includes(nextState);
  }

  transition(nextState, reason = "") {
    if (!this.can(nextState)) {
      throw new Error(`Transição inválida: ${this.state} -> ${nextState}`);
    }

    const previous = this.state;
    this.state = nextState;

    const record = {
      from: previous,
      to: nextState,
      reason,
      at: new Date().toISOString(),
    };

    this.history.push(record);
    return record;
  }

  current() {
    return this.state;
  }

  getHistory() {
    return this.history;
  }
}

module.exports = StateMachine;
