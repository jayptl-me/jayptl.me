// A fake game platform client that counts its calls.
export function fakeSteam(value) {
  let calls = 0;
  return {
    get calls() { return calls; },
    async activity() { calls++; return value; }
  };
}
