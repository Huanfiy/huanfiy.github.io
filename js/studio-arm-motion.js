/* Shared assembly dimensions and deterministic motion. No Three.js or room state. */
const part = Object.freeze({ width: .15, depth: .13, thickness: .018 });
const fixture = Object.freeze({ floorTop: .096, floorThickness: .008, supportHeight: .022, supportEmbed: .003 });
// In tool space +y points down; toolLength is the wrist-to-PCB-centre distance.
const gripper = Object.freeze({
    toolLength: .38, fingerTop: .220, fingerThickness: .022, fingerOverhang: .014,
    padThickness: .010, padHeight: .044, padAboveTcp: .011, openingTravel: .054
});

/**
 * Derive contact geometry from physical dimensions, not separately tuned offsets.
 * Fixture/part y is in base space (+up); finger/pad y is in tool space (+down).
 * @param {object} dimensions
 * @param {{width: number, depth: number, thickness: number}} dimensions.part
 * @param {{floorTop: number, floorThickness: number, supportHeight: number, supportEmbed: number}} dimensions.fixture
 * @param {{toolLength: number, fingerTop: number, fingerThickness: number, fingerOverhang: number,
 *   padThickness: number, padHeight: number, padAboveTcp: number, openingTravel: number}} dimensions.gripper
 * @returns {Readonly<{supportY: number, partY: number, padX: number, padInnerX: number,
 *   padY: number, jawClosedX: number, jawOpenX: number, fingerY: number, fingerHeight: number}>}
 */
export function deriveArmFit({ part, fixture, gripper }) {
    const supportY = fixture.floorTop - fixture.supportEmbed + fixture.supportHeight / 2;
    const padX = (gripper.fingerThickness + gripper.padThickness) / 2;
    const padInnerX = padX + gripper.padThickness / 2;
    const jawClosedX = part.width / 2 + padInnerX;
    const fingerBottom = gripper.toolLength + gripper.fingerOverhang;
    return Object.freeze({
        supportY, partY: supportY + fixture.supportHeight / 2 + part.thickness / 2,
        padX, padInnerX, padY: gripper.toolLength - gripper.padAboveTcp,
        jawClosedX, jawOpenX: jawClosedX + gripper.openingTravel,
        fingerY: (gripper.fingerTop + fingerBottom) / 2,
        fingerHeight: fingerBottom - gripper.fingerTop
    });
}

export const ARM = Object.freeze({
    cycle: 10, upper: .90, forearm: .78, yawY: .25, shoulderY: .43,
    part, fixture, gripper, fit: deriveArmFit({ part, fixture, gripper }),
    pick: Object.freeze({ x: -.52, z: -.40 }),
    place: Object.freeze({ x: .52, z: -.40 }),
    home: Object.freeze({ radius: .60, wristY: 1.46, yaw: .12 })
});

// Normalized cycle boundaries. Adjacent actions share an endpoint; grasp/release
// ownership switches use the same boundary as the finger motion they depend on.
export const ARM_PHASE = Object.freeze({
    START: 0,
    PICK_APPROACH_END: .15,
    PICK_LOWER_START: .16,
    PICK_LOWER_END: .27,
    PICK_CLOSE_START: .275,
    PICK_CLOSE_END: .31,
    PICK_LIFT_START: .33,
    PICK_LIFT_END: .44,
    TRANSFER_END: .60,
    PLACE_LOWER_END: .70,
    PLACE_RELEASE_START: .715,
    PLACE_RELEASE_END: .75,
    PLACE_LIFT_START: .77,
    PLACE_LIFT_END: .85,
    RESTOCK: .94,
    END: 1
});

const mix = (a, b, t) => a + (b - a) * t;
// Zero velocity AND acceleration at every dwell, including the loop seam.
const ease = (phase, start, end) => {
    const t = Math.max(0, Math.min(1, (phase - start) / (end - start)));
    return Math.max(0, Math.min(1, t * t * t * (10 + t * (-15 + 6 * t))));
};

/** @returns {{yaw: number, shoulder: number, elbow: number, wrist: number, roll: number}} Joint rotations in radians. */
export function solveArmPose(radius, wristY, yaw) {
    const y = wristY - ARM.shoulderY;
    const cosine = Math.max(-1, Math.min(1, (radius * radius + y * y - ARM.upper ** 2 - ARM.forearm ** 2) / (2 * ARM.upper * ARM.forearm)));
    const elbow = Math.acos(cosine);
    const shoulder = Math.atan2(radius, y) - Math.atan2(ARM.forearm * Math.sin(elbow), ARM.upper + ARM.forearm * Math.cos(elbow));
    return { yaw, shoulder: -shoulder, elbow: -elbow, wrist: shoulder + elbow + Math.PI, roll: yaw };
}

/**
 * @param {number} seconds Accumulated simulation time; the caller freezes it on pause.
 * @param {boolean} [started=true] False selects the stationary home pose.
 * @returns {{phase: number, radius: number, wristY: number, grip: number, carrying: boolean,
 *   pickVisible: boolean, placedVisible: boolean, yaw: number, shoulder: number,
 *   elbow: number, wrist: number, roll: number}} Phase/grip are normalized; angles are radians.
 */
export function sampleArmMotion(seconds, started = true) {
    const elapsed = seconds % ARM.cycle;
    const phase = (elapsed < 0 ? elapsed + ARM.cycle : elapsed) / ARM.cycle;
    let { radius, wristY, yaw } = ARM.home;
    let grip = 0, carrying = false, pickVisible = true, placedVisible = false;
    if (started) {
        const p = ARM_PHASE;
        const approach = ease(phase, p.START, p.PICK_APPROACH_END);
        const transfer = ease(phase, p.PICK_LIFT_END, p.TRANSFER_END);
        const home = ease(phase, p.PLACE_LIFT_END, p.END);
        const pickYaw = Math.atan2(-ARM.pick.z, ARM.pick.x), placeYaw = Math.atan2(-ARM.place.z, ARM.place.x);
        const pickRadius = Math.hypot(ARM.pick.x, ARM.pick.z), placeRadius = Math.hypot(ARM.place.x, ARM.place.z);
        yaw = mix(mix(ARM.home.yaw, pickYaw, approach), placeYaw, transfer);
        radius = mix(mix(ARM.home.radius, pickRadius, approach), placeRadius, transfer);
        yaw = mix(yaw, ARM.home.yaw, home); radius = mix(radius, ARM.home.radius, home);
        const pickDown = ease(phase, p.PICK_LOWER_START, p.PICK_LOWER_END) - ease(phase, p.PICK_LIFT_START, p.PICK_LIFT_END);
        const placeDown = ease(phase, p.TRANSFER_END, p.PLACE_LOWER_END) - ease(phase, p.PLACE_LIFT_START, p.PLACE_LIFT_END);
        wristY = mix(ARM.home.wristY, ARM.fit.partY + ARM.gripper.toolLength, pickDown + placeDown);
        grip = ease(phase, p.PICK_CLOSE_START, p.PICK_CLOSE_END) - ease(phase, p.PLACE_RELEASE_START, p.PLACE_RELEASE_END);
        carrying = phase >= p.PICK_CLOSE_END && phase < p.PLACE_RELEASE_START;
        // Restock only after the open tool has lifted clear of the destination.
        placedVisible = phase >= p.PLACE_RELEASE_START && phase < p.RESTOCK;
        pickVisible = phase < p.PICK_CLOSE_END || phase >= p.RESTOCK;
    }
    return { phase, radius, wristY, grip, carrying, pickVisible, placedVisible, ...solveArmPose(radius, wristY, yaw) };
}
