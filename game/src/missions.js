// The story: Ren Maro, new in Solara Bay, runs jobs for Marla Reyes at the
// Marina Row garage. Three missions, each with briefing dialogue, a beaconed
// objective, and a cash reward — then free roam with side work. The mission
// manager is a small step machine: a step is done when the player reaches its
// target, or when its check() says so. The Vanta GT is not a mission car —
// it is a free-roam prize parked on Marina Row, there for the taking.
import { distance2D } from './rng.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Mission 1 — First Wheels',
    reward: 600,
    briefing: [
      ['Marla Reyes', 'Ren. You want work in this city, you start with wheels. There is a sunset-orange Solano GT parked on Marina Row, keys in the sun visor. Bring it to my garage. No scratches. Well — few scratches.'],
      ['Ren Maro', 'One stolen coupe, coming up. What could go wrong?'],
    ],
    steps: [
      { text: 'Steal the orange Solano GT on Marina Row', target: { x: 58, z: 116 }, radius: 6, kind: 'steal-car' },
      { text: 'Drive the Solano GT to the Marina Row garage', target: { x: -58, z: -58 }, radius: 9, kind: 'deliver-car' },
    ],
  },
  {
    id: 'bayfront-drop',
    title: 'Mission 2 — Bayfront Drop',
    reward: 1500,
    briefing: [
      ['Marla Reyes', 'Good driving. Now the real job: a package for my buyer at Coral Pier. The Bay PD has the whole waterfront crawling tonight, so do not dawdle. Deliver it and you are $1,500 richer.'],
      ['Ren Maro', 'A package, a pier, and the whole PD. Just another Tuesday.'],
    ],
    steps: [
      { text: 'Pick up the package at the garage', target: { x: -58, z: -58 }, radius: 7, kind: 'pickup' },
      { text: 'Deliver the package to Coral Pier — lose the cops if they spot you', target: { x: 0, z: 168 }, radius: 9, kind: 'deliver', wantedOnStart: 2 },
    ],
  },
  {
    id: 'harbor-showdown',
    title: 'Mission 3 — Harbor Showdown',
    reward: 3500,
    briefing: [
      ['Marla Reyes', 'The Red Tide crew jumped my driver at the East Docks and took my cash box. Three of them, armed. Take it back, Ren. The pistol is in the glove box — you will need it.'],
      ['Ren Maro', 'Three armed crew, one cash box. Time to collect.'],
    ],
    steps: [
      { text: 'Reach the East Docks warehouse', target: { x: 150, z: 0 }, radius: 12, kind: 'reach' },
      { text: 'Deal with the Red Tide crew (3)', target: { x: 150, z: 0 }, radius: 30, kind: 'clear-enemies' },
      { text: 'Collect the cash box', target: { x: 150, z: 0 }, radius: 6, kind: 'collect' },
    ],
  },
];

export function createMissions(city, hooks) {
  let index = 0; // which mission is active; index === MISSIONS.length means free roam
  let stepIndex = 0;
  let active = false;
  let dialogueQueue = [];
  let dialogueLine = null;
  let enemiesLeft = 0;
  let missionCar = null;

  function current() { return index < MISSIONS.length ? MISSIONS[index] : null; }
  function currentStep() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }
  function objectiveText() {
    if (!active) return 'Free roam — cause trouble, or press R to replay the story.';
    const s = currentStep();
    return s ? s.text : 'Mission complete.';
  }
  function objectiveTarget() {
    const s = currentStep();
    return s ? s.target : null;
  }

  function startMission(i) {
    index = i;
    stepIndex = 0;
    active = true;
    enemiesLeft = 0;
    missionCar = null;
    const m = current();
    dialogueQueue = [...m.briefing];
    advanceDialogue();
    const step = currentStep();
    if (step && step.wantedOnStart) hooks.onWanted(step.wantedOnStart);
    hooks.onObjective(m.title, step ? step.text : '');
    if (step) city.setBeacon(step.target.x, step.target.z, true);
  }

  function advanceDialogue() {
    dialogueLine = dialogueQueue.length > 0 ? dialogueQueue.shift() : null;
    hooks.onDialogue(dialogueLine);
  }

  function completeStep() {
    const m = current();
    stepIndex += 1;
    if (stepIndex >= m.steps.length) {
      completeMission();
      return;
    }
    const step = currentStep();
    if (step.wantedOnStart) hooks.onWanted(step.wantedOnStart);
    if (step.kind === 'clear-enemies') {
      enemiesLeft = hooks.onSpawnEnemies();
    }
    hooks.onObjective(m.title, step.text);
    city.setBeacon(step.target.x, step.target.z, true);
  }

  function completeMission() {
    const m = current();
    active = false;
    city.setBeacon(0, 0, false);
    hooks.onMissionComplete(m);
    index += 1;
    stepIndex = 0;
    if (index < MISSIONS.length) {
      dialogueQueue = [[
        'Marla Reyes',
        index === 1
          ? 'Nice work, Ren. The garage door is open whenever you want the next job — come see me.'
          : 'The cash box is back where it belongs. You are not a rookie anymore, Ren. Solara Bay is yours now.',
      ]];
      advanceDialogue();
    }
  }

  // Called every step with the player's position, car and combat state.
  function update(playerPos, playerCar, context) {
    if (!active) return;
    const step = currentStep();
    if (!step) return;
    const target = step.target;
    const d = distance2D(playerPos.x, playerPos.z, target.x, target.z);
    if (step.kind === 'steal-car') {
      if (playerCar && playerCar.isMissionCar) {
        missionCar = playerCar;
        hooks.onToast('Solano GT acquired', 'Get it to the garage in one piece', 'gold');
        completeStep();
      }
    } else if (step.kind === 'deliver-car') {
      if (playerCar === missionCar && d < step.radius) completeStep();
    } else if (step.kind === 'pickup') {
      if (d < step.radius) { hooks.onToast('Package picked up', 'Now run it to Coral Pier', 'gold'); completeStep(); }
    } else if (step.kind === 'deliver') {
      if (d < step.radius) completeStep();
    } else if (step.kind === 'reach') {
      if (d < step.radius) {
        enemiesLeft = hooks.onSpawnEnemies();
        hooks.onToast('Red Tide crew', `${enemiesLeft} armed rivals — take them down`, 'bad');
        completeStep();
      }
    } else if (step.kind === 'clear-enemies') {
      enemiesLeft = context.enemiesLeft;
      if (enemiesLeft <= 0) {
        hooks.onToast('Crew dealt with', 'Grab the cash box', 'good');
        completeStep();
      }
    } else if (step.kind === 'collect') {
      if (d < step.radius) completeStep();
    }
  }

  function skipToFreeRoam() {
    active = false;
    index = MISSIONS.length;
    stepIndex = 0;
    city.setBeacon(0, 0, false);
    dialogueLine = null;
    hooks.onDialogue(null);
  }

  return {
    get index() { return index; },
    get active() { return active; },
    get dialogueLine() { return dialogueLine; },
    get missionCar() { return missionCar; },
    current, currentStep, objectiveText, objectiveTarget,
    startMission, advanceDialogue, completeMission, update, skipToFreeRoam,
  };
}
