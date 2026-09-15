const assert = require('node:assert/strict');
const test = require('node:test');
const motion = import('../js/studio-arm-motion.js');
const close = (a, b, message, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${message}: ${a} vs ${b}`);

function toolCenter(ARM, pose) {
    const sum = pose.shoulder + pose.elbow;
    const radius = -ARM.upper * Math.sin(pose.shoulder) - ARM.forearm * Math.sin(sum);
    return {
        x: radius * Math.cos(pose.yaw), z: -radius * Math.sin(pose.yaw),
        y: ARM.shoulderY + ARM.upper * Math.cos(pose.shoulder) + ARM.forearm * Math.cos(sum) - ARM.gripper.toolLength
    };
}

function assertFit({ part, fixture, gripper }, fit) {
    close(fit.partY - part.thickness / 2, fit.supportY + fixture.supportHeight / 2, 'PCB rests on support tops');
    close(fit.supportY - fixture.supportHeight / 2, fixture.floorTop - fixture.supportEmbed, 'supports sit in the nest');
    close(fit.padX - gripper.padThickness / 2, gripper.fingerThickness / 2, 'pad back meets finger');
    close(fit.jawClosedX - fit.padX - gripper.padThickness / 2, part.width / 2, 'closed pad contacts PCB edge');
    close(fit.jawOpenX - fit.jawClosedX, gripper.openingTravel, 'opening has explicit clearance');
    close(fit.fingerY - fit.fingerHeight / 2, gripper.fingerTop, 'finger meets its slider');
    close(fit.fingerY + fit.fingerHeight / 2, gripper.toolLength + gripper.fingerOverhang, 'finger reaches past the TCP');
    assert.ok(Math.abs(fit.padY - gripper.toolLength) + part.thickness / 2 <= gripper.padHeight / 2 + 1e-9, 'pad must cover both PCB edges');
}

test('assembly dimensions derive the tool, grip and fixture contacts from one source', async () => {
    const { ARM, deriveArmFit } = await motion;
    assertFit(ARM, ARM.fit);
    assert.deepEqual(deriveArmFit(ARM), ARM.fit);
    assert.ok(Object.isFrozen(ARM) && ['part', 'fixture', 'gripper', 'fit'].every(key => Object.isFrozen(ARM[key])));
});

test('changing part, support or gripper dimensions propagates without retuning contact offsets', async () => {
    const { ARM, deriveArmFit } = await motion;
    const changes = [
        ['part', 'width', .04, { jawClosedX: .02, jawOpenX: .02 }],
        ['part', 'thickness', .004, { partY: .002 }],
        ['fixture', 'floorTop', .02, { supportY: .02, partY: .02 }],
        ['fixture', 'supportHeight', .01, { supportY: .005, partY: .01 }],
        ['gripper', 'padThickness', .004, { padX: .002, padInnerX: .004, jawClosedX: .004, jawOpenX: .004 }],
        ['gripper', 'fingerThickness', .008, { padX: .004, padInnerX: .004, jawClosedX: .004, jawOpenX: .004 }],
        ['gripper', 'toolLength', .08, { padY: .08, fingerY: .04, fingerHeight: .08 }],
        ['gripper', 'openingTravel', .02, { jawOpenX: .02 }]
    ];
    for (const [section, key, delta, expected] of changes) {
        const dimensions = { ...ARM, [section]: { ...ARM[section], [key]: ARM[section][key] + delta } };
        const fit = deriveArmFit(dimensions);
        assertFit(dimensions, fit);
        for (const name of Object.keys(ARM.fit)) close(fit[name] - ARM.fit[name], expected[name] || 0, `${section}.${key} -> ${name}`);
    }
});

test('named cycle boundaries preserve ordered dwell, grasp, lift, release and restock', async () => {
    const { ARM_PHASE: p } = await motion;
    const order = ['START', 'PICK_APPROACH_END', 'PICK_LOWER_START', 'PICK_LOWER_END', 'PICK_CLOSE_START', 'PICK_CLOSE_END', 'PICK_LIFT_START', 'PICK_LIFT_END', 'TRANSFER_END', 'PLACE_LOWER_END', 'PLACE_RELEASE_START', 'PLACE_RELEASE_END', 'PLACE_LIFT_START', 'PLACE_LIFT_END', 'RESTOCK', 'END'];
    assert.equal(p.START, 0); assert.equal(p.END, 1); assert.ok(Object.isFrozen(p));
    for (let i = 1; i < order.length; i++) assert.ok(p[order[i - 1]] < p[order[i]], `${order[i]} must follow ${order[i - 1]}`);
});

test('forward kinematics hit both fixtures exactly throughout the grasp/release dwells', async () => {
    const { ARM, ARM_PHASE: p, sampleArmMotion } = await motion;
    for (const [start, end, point] of [[p.PICK_LOWER_END, p.PICK_LIFT_START, ARM.pick], [p.PLACE_LOWER_END, p.PLACE_LIFT_START, ARM.place]]) {
        for (let i = 0; i <= 60; i++) {
            const phase = start + (end - start) * i / 60;
            const pose = sampleArmMotion(phase * ARM.cycle), tcp = toolCenter(ARM, pose);
            close(tcp.x, point.x, 'fixture x'); close(tcp.z, point.z, 'fixture z'); close(tcp.y, ARM.fit.partY, 'fixture y');
        }
    }
});

test('the full cycle stays reachable, level and inside the tabletop work envelope', async () => {
    const { ARM, sampleArmMotion } = await motion;
    for (let i = 0; i < 5000; i++) {
        const pose = sampleArmMotion(i / 5000 * ARM.cycle), tcp = toolCenter(ARM, pose);
        close(Math.hypot(tcp.x, tcp.z), pose.radius, 'reachable radius'); close(tcp.y + ARM.gripper.toolLength, pose.wristY, 'reachable height');
        close(pose.shoulder + pose.elbow + pose.wrist, Math.PI, 'tool faces down');
        close(pose.roll, pose.yaw, 'counter-roll keeps the carried PCB orientation');
        assert.ok(Math.abs(tcp.x) < .72 && Math.abs(tcp.z) < .72 && tcp.y >= ARM.fit.partY - 1e-9, 'tool escaped its plate or sank through a fixture');
        assert.ok(pose.grip >= 0 && pose.grip <= 1);
        assert.equal(Number(pose.carrying) + Number(pose.pickVisible) + Number(pose.placedVisible), 1, 'part disappeared or duplicated');
        if (pose.carrying) close(pose.grip, 1, 'closed fingers support the carried part');
    }
});

test('ownership switches only after alignment, and uses the same boundaries as the fingers', async () => {
    const { ARM, ARM_PHASE: p, sampleArmMotion } = await motion;
    for (const [phase, point, beforeOwner, afterOwner] of [
        [p.PICK_CLOSE_END, ARM.pick, 'pickVisible', 'carrying'],
        [p.PLACE_RELEASE_START, ARM.place, 'carrying', 'placedVisible']
    ]) {
        for (const offset of [-1e-7, 0, 1e-7]) {
            const pose = sampleArmMotion((phase + offset) * ARM.cycle), tcp = toolCenter(ARM, pose);
            close(tcp.x, point.x, 'handoff x'); close(tcp.z, point.z, 'handoff z'); close(tcp.y, ARM.fit.partY, 'handoff y');
            close(pose.grip, 1, 'handoff occurs at closed fingers');
            assert.equal(pose[offset < 0 ? beforeOwner : afterOwner], true);
        }
    }
    const releaseEnd = sampleArmMotion(p.PLACE_RELEASE_END * ARM.cycle);
    assert.equal(releaseEnd.placedVisible, true); close(releaseEnd.grip, 0, 'open before lifting');
    // Multiplying a normalized boundary by cycle seconds may round one ULP below it.
    assert.equal(sampleArmMotion((p.RESTOCK - 1e-7) * ARM.cycle).placedVisible, true);
    const restocked = sampleArmMotion((p.RESTOCK + 1e-7) * ARM.cycle);
    assert.equal(restocked.pickVisible, true); close(restocked.wristY, ARM.home.wristY, 'lift clear before restock');
});

test('approach, travel and loop seam are smooth; yaw turns happen only with a raised tool', async () => {
    const { ARM, sampleArmMotion } = await motion;
    let previous = sampleArmMotion(0);
    for (let i = 1; i <= 10000; i++) {
        const pose = sampleArmMotion(i / 10000 * ARM.cycle);
        for (const key of ['yaw', 'shoulder', 'elbow', 'wrist', 'roll', 'grip']) assert.ok(Math.abs(pose[key] - previous[key]) < .006, `discontinuity in ${key}`);
        if (Math.abs(pose.yaw - previous.yaw) > 1e-7) close(pose.wristY, ARM.home.wristY, 'yaw clearance');
        previous = pose;
    }
    const idle = sampleArmMotion(0, false), start = sampleArmMotion(0), end = sampleArmMotion(ARM.cycle);
    for (const key of ['yaw', 'shoulder', 'elbow', 'wrist', 'roll', 'grip']) { close(idle[key], start[key], 'idle -> start'); close(start[key], end[key], 'loop seam'); }
    const first = sampleArmMotion(.234 * ARM.cycle), second = sampleArmMotion(1.234 * ARM.cycle);
    for (const key of Object.keys(first)) {
        if (typeof first[key] === 'number') close(first[key], second[key], `periodic ${key}`);
        else assert.equal(first[key], second[key]);
    }
});
