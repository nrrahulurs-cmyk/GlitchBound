const VEHICLE_VISUAL_KEY = 'glitchboundVehicleVisual';

/** Register one render-only vehicle model against an existing stable placement ID. */
export function registerVehicleVisual(scene, visual, placement) {
  if (!scene?.add || !visual?.isObject3D) throw new TypeError('A Three.js scene and vehicle Object3D are required.');
  if (typeof placement?.id !== 'string' || !placement.id || typeof placement.asset !== 'string' || !placement.asset) {
    throw new TypeError('A vehicle placement must have a stable id and asset key.');
  }

  let duplicate = false;
  scene.traverse(object => {
    if (object.userData?.[VEHICLE_VISUAL_KEY]?.id === placement.id) duplicate = true;
  });
  if (duplicate) throw new Error(`Duplicate vehicle visual registration: ${placement.id}`);

  visual.userData[VEHICLE_VISUAL_KEY] = {
    id: placement.id,
    asset: placement.asset,
    modelPath: `/assets/${placement.asset}.glb`,
    role: placement.role || 'vehicle visual'
  };
  scene.add(visual);
  return visual;
}

/** Return render-model registrations separately from procedural traffic and physics bodies. */
export function getVehicleVisualRegistry(scene) {
  const vehicles = [];
  scene?.traverse(object => {
    const registration = object.userData?.[VEHICLE_VISUAL_KEY];
    if (!registration) return;
    vehicles.push({
      ...registration,
      objectName: object.name,
      visible: object.visible,
      position: [object.position.x, object.position.y, object.position.z]
    });
  });
  const counts = new Map();
  for (const vehicle of vehicles) counts.set(vehicle.id, (counts.get(vehicle.id) || 0) + 1);
  return {
    count: vehicles.length,
    vehicles,
    duplicateIds: [...counts].filter(([, count]) => count > 1).map(([id]) => id)
  };
}
