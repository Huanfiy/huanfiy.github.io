/* Desktop pick-and-place arm. Model and motion share dimensions, not room state. */
import * as THREE from 'three';
import { ARM, sampleArmMotion } from './studio-arm-motion.js';

/**
 * @typedef {object} ArmControls
 * @property {boolean} running Advance the cycle; the caller only starts a started arm.
 * @property {boolean} started Distinguish the initial home pose from a paused cycle.
 */

/**
 * Build into caller-owned groups. Room primitives attach meshes and share caches;
 * own() registers custom resources with that same room, including partial failure.
 * No independent RAF, listeners or disposer: update only while the room is alive.
 *
 * batch() is destructive: it replaces rigid meshes and adds the ink contour.
 * This module batches only assembly() groups, never joints, workpiece containers,
 * the status lamp or deforming cables. The room batches fixed once, after assembly.
 * @param {object} services Room primitive signatures are defined in studio-room.js.
 * @param {THREE.Group} services.root Device root, with picking identity owned by the room.
 * @param {THREE.Group} services.fixed Static child of root; finalized by the room.
 * @param {Function} services.group Attach an empty group at a local position.
 * @param {Function} services.box Attach a cached rounded box.
 * @param {Function} services.cylinder Attach a cached cylinder.
 * @param {Function} services.bar Attach a rod between two local points.
 * @param {Function} services.cable Attach a static tube along local points.
 * @param {Function} services.material Get/create a room-owned material by name.
 * @param {Function} services.canvasTexture Draw a room-owned canvas texture once.
 * @param {Function} services.batch Merge a completed rigid assembly in place.
 * @param {Function} services.own Register a custom resource and return it unchanged.
 * @param {Object<string, THREE.MeshStandardMaterial>} services.m Shared palette; never dispose or mutate it here.
 * @returns {{update: (dt: number, controls: ArmControls) => number}} Update returns rounded cycle percent.
 */
export function createStudioArm({ root, fixed, group, box, cylinder, bar, cable, material, canvasTexture, batch, own, m }) {
    const alloy = material('armAlloy', { color: '#b9beb2', metalness: .42, roughness: .57 });
    const rubber = material('armRubber', { color: '#3d4943', roughness: .96 });
    const { part: partSize, fixture: fixtureSize, gripper, fit } = ARM;
    // The static loom and moving service loops meet at these same local endpoints.
    const loom = { x: -.10, z: -.25, outgoingY: .15, incomingY: -.12 };
    const rigid = [];
    function assembly(parent, name) {
        const body = group(parent); body.name = name; rigid.push(body); return body;
    }
    function disc(parent, r, depth, x, y, z, mat, segments = 32) {
        const mesh = cylinder(parent, r, r, depth, x, y, z, mat, segments);
        mesh.rotation.x = Math.PI / 2; return mesh;
    }
    function bolt(parent, x, y, z, r = .015, face = 'z') {
        const mount = group(parent, x, y, z);
        if (face === 'y') mount.rotation.x = -Math.PI / 2;
        disc(mount, r * 1.45, .004, 0, 0, 0, alloy, 12);
        disc(mount, r, .008, 0, 0, 0, rubber, 6);
    }
    function ring(parent, radius, tube, x, y, z, mat) {
        const mesh = new THREE.Mesh(own(new THREE.TorusGeometry(radius, tube, 6, 32)), mat);
        mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
    }
    // Cast, gently waisted link shells instead of equal-width rounded boxes.
    function shell(parent, length, lower, upper, depth, x, y, z, mat, bevel = .006) {
        const shape = new THREE.Shape(); shape.moveTo(-lower, 0);
        shape.bezierCurveTo(-lower * .95, length * .26, -upper * .74, length * .70, -upper, length);
        shape.absarc(0, length, upper, Math.PI, 0, true);
        shape.bezierCurveTo(upper * .74, length * .70, lower * .95, length * .26, lower, 0);
        shape.absarc(0, 0, lower, 0, -Math.PI, true); shape.closePath();
        const geometry = own(new THREE.ExtrudeGeometry(shape, {
            depth, bevelEnabled: true, bevelSegments: 1, steps: 1,
            bevelSize: bevel, bevelThickness: bevel, curveSegments: 8
        }));
        geometry.translate(0, 0, -depth / 2);
        const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z);
        mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }

    function createDecals() {
        const atlas = canvasTexture(768, 256, (ctx, w) => {
            ctx.fillStyle = '#56665c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ['HF / A-04', '02 · LINK', 'P-GRIP', '24V / I·O'].forEach((text, i) => {
                ctx.font = `600 ${i < 2 ? 43 : 36}px monospace`; ctx.fillText(text, w / 2, i * 64 + 32);
            });
        });
        const decalMaterial = own(new THREE.MeshStandardMaterial({
            map: atlas.texture, transparent: true, depthWrite: false, roughness: .9,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
        }));
        return (parent, row, w, h, x, y, z) => {
            const geometry = own(new THREE.PlaneGeometry(w, h)), uv = geometry.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setY(i, (3 - row + uv.getY(i)) / 4);
            const mesh = new THREE.Mesh(geometry, decalMaterial);
            mesh.position.set(x, y, z); parent.add(mesh); return mesh;
        };
    }

    function buildBase() {
        // Anchored tooling plate; both nests face the room and sit outside the base.
        box(fixed, 1.60, .06, 1.36, 0, 0, 0, m.teal, .035);
        const plateArt = canvasTexture(768, 640, (ctx, w, h) => {
            const X = x => (.5 - x / 1.56) * w, Z = z => (.5 - z / 1.32) * h;
            ctx.fillStyle = '#a9bba2'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(244,239,218,.23)'; ctx.lineWidth = 1;
            for (let x = -.7; x < .76; x += .1) { ctx.beginPath(); ctx.moveTo(X(x), 12); ctx.lineTo(X(x), h - 12); ctx.stroke(); }
            for (let z = -.6; z < .65; z += .1) { ctx.beginPath(); ctx.moveTo(12, Z(z)); ctx.lineTo(w - 12, Z(z)); ctx.stroke(); }
            ctx.strokeStyle = '#788e7c'; ctx.lineWidth = 2; ctx.strokeRect(8, 8, w - 16, h - 16);
            ctx.fillStyle = '#4b6155'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = '600 24px monospace'; ctx.fillText('HUANFLY / ARM-04', X(0), Z(.54));
            ctx.font = '12px monospace'; ctx.fillText('DESKTOP ASSEMBLY · 5 AXIS + GRIP', X(0), Z(.47));
            for (const [point, label] of [[ARM.pick, '01 / PICK'], [ARM.place, '02 / PLACE']]) {
                ctx.font = '600 17px monospace'; ctx.fillText(label, X(point.x), Z(-.61));
                ctx.setLineDash([5, 5]); ctx.strokeRect(X(point.x + .19), Z(point.z + .17), .38 / 1.56 * w, .34 / 1.32 * h); ctx.setLineDash([]);
            }
            ctx.strokeStyle = '#ebe6cf'; ctx.lineWidth = 3;
            for (let i = 0; i < 5; i++) { const x = -.10 + i * .045; ctx.beginPath(); ctx.moveTo(X(x), Z(-.53)); ctx.lineTo(X(x + .025), Z(-.59)); ctx.stroke(); }
        });
        const plateFace = new THREE.Mesh(own(new THREE.PlaneGeometry(1.56, 1.32)), own(new THREE.MeshStandardMaterial({ map: plateArt.texture, roughness: .95 })));
        plateFace.rotation.set(-Math.PI / 2, 0, Math.PI); plateFace.position.y = .031; plateFace.receiveShadow = true; fixed.add(plateFace);
        for (const x of [-.73, .73]) for (const z of [-.60, .60]) bolt(fixed, x, .037, z, .016, 'y');
        box(fixed, .64, .036, .61, 0, .053, 0, rubber, .025);
        for (const x of [-.265, .265]) for (const z of [-.25, .25]) bolt(fixed, x, .075, z, .018, 'y');
        cylinder(fixed, .25, .28, .13, 0, .13, 0, m.black, 40);
        cylinder(fixed, .255, .255, .027, 0, .208, 0, alloy, 40);
        cylinder(fixed, .24, .24, .018, 0, .230, 0, rubber, 40);
        for (let i = 0; i < 7; i++) {
            const a = -.9 + i * .30;
            const vent = box(fixed, .031, .050, .008, Math.sin(a) * .269, .13, -Math.cos(a) * .269, rubber, .003);
            vent.rotation.y = -a;
        }
        box(fixed, .14, .06, .055, .11, .118, .254, alloy, .008);
        cable(fixed, [[.11, .12, .284], [.14, .065, .37], [.39, .052, .39], [.63, .052, .45], [.76, .038, .56]], rubber, .012);
        const powerLabel = decal(fixed, 3, .25, .038, .51, .033, .31);
        powerLabel.rotation.set(-Math.PI / 2, 0, Math.PI);
        const status = cylinder(root, .017, .017, .012, -.17, .079, -.245, m.amberGlow, 12);
        status.name = 'arm-status';

        const yaw = group(root, 0, ARM.yawY, 0); yaw.name = 'arm-yaw';
        const turntable = assembly(yaw, 'arm-turntable');
        cylinder(turntable, .224, .236, .075, 0, .031, 0, m.orange, 40);
        cylinder(turntable, .215, .215, .014, 0, .077, 0, alloy, 40);
        // Two load-bearing cheeks straddle the shoulder axle.
        for (const side of [-1, 1]) {
            shell(turntable, .12, .118, .13, .043, 0, .08, side * .168, m.orange);
            bolt(turntable, -.074, .09, side * .195, .013);
            bolt(turntable, .074, .09, side * .195, .013);
        }
        return { yaw, status };
    }

    function buildJoint(parent, radius, width, count) {
        disc(parent, radius, width, 0, 0, 0, rubber);
        for (const side of [-1, 1]) {
            const z = side * (width / 2 + .012);
            disc(parent, radius * .94, .023, 0, 0, z, alloy);
            disc(parent, radius * .76, .030, 0, 0, z + side * .018, m.cream);
            ring(parent, radius * .81, .006, 0, 0, z + side * .033, alloy);
            disc(parent, radius * .29, .008, 0, 0, z + side * .037, rubber, 20);
            disc(parent, radius * .17, .009, 0, 0, z + side * .042, alloy, 12);
            for (let i = 0; i < count; i++) {
                const a = i * Math.PI * 2 / count;
                bolt(parent, Math.cos(a) * radius * .60, Math.sin(a) * radius * .60, z + side * .036, radius * .070);
            }
            box(parent, .008, radius * .16, .005, 0, radius * .86, z + side * .035, m.orange, .001);
        }
    }
    function buildLink(parent, length, lower, top, row) {
        shell(parent, length, lower, top, .16, 0, 0, 0, m.orange);
        for (const side of [-1, 1]) {
            shell(parent, length - .36, lower * .69, top * .69, .006, 0, .18, side * .089, rubber, .003);
            shell(parent, length - .38, lower * .60, top * .60, .008, 0, .19, side * .097, m.cream, .003);
            for (const y of [.19, length - .19]) bolt(parent, 0, y, side * .107, .011);
            const label = decal(parent, row, length * .35, .039, 0, length * .50, side * .109);
            label.rotation.set(0, side < 0 ? Math.PI : 0, Math.PI / 2);
        }
        cable(parent, [[loom.x, loom.outgoingY, loom.z], [-lower - .015, .27, -.12], [-top - .015, length - .24, -.12], [loom.x, length + loom.incomingY, loom.z]], rubber, .010);
        for (const [y, x] of [[.27, -lower - .015], [length - .24, -top - .015]]) {
            box(parent, .042, .025, .035, x + .008, y, -.102, m.orange, .003);
            box(parent, .034, .016, .028, x, y, -.12, alloy, .003);
        }
    }
    function buildLinks(yaw) {
        const shoulder = group(yaw, 0, ARM.shoulderY - ARM.yawY, 0); shoulder.name = 'arm-shoulder';
        const upper = assembly(shoulder, 'arm-upper-shell');
        const elbow = group(shoulder, 0, ARM.upper, 0); elbow.name = 'arm-elbow';
        const forearm = assembly(elbow, 'arm-forearm-shell');
        const wrist = group(elbow, 0, ARM.forearm, 0); wrist.name = 'arm-wrist';
        const wristBody = assembly(wrist, 'arm-wrist-housing');
        buildJoint(upper, .151, .36, 6); buildLink(upper, ARM.upper, .118, .100, 0);
        buildJoint(forearm, .134, .26, 6); buildLink(forearm, ARM.forearm, .100, .080, 1);
        buildJoint(wristBody, .096, .20, 4);
        cylinder(wristBody, .073, .078, .070, 0, .065, 0, alloy, 24);
        cylinder(wristBody, .080, .080, .018, 0, .089, 0, rubber, 24);
        return { shoulder, elbow, wrist, wristBody };
    }

    function buildGripper(wrist) {
        const tool = group(wrist); tool.name = 'arm-tool-roll';
        const palm = assembly(tool, 'arm-gripper-body');
        box(palm, .29, .107, .17, 0, .145, 0, rubber, .018);
        box(palm, .26, .062, .012, 0, .142, -.090, m.cream, .004);
        decal(palm, 2, .18, .037, 0, .142, -.097).rotation.y = Math.PI;
        for (const x of [-.115, .115]) bolt(palm, x, .142, -.101, .011);
        for (const z of [-.053, .053]) bar(palm, [-fit.jawOpenX, .215, z], [fit.jawOpenX, .215, z], .012, alloy);
        box(palm, 2 * fit.jawOpenX, .025, .038, 0, .208, 0, m.metal, .004);
        const jaws = [-1, 1].map(side => {
            const jaw = group(tool); jaw.name = side < 0 ? 'arm-jaw-left' : 'arm-jaw-right';
            const body = assembly(jaw, 'arm-jaw-detail');
            box(body, .060, .046, .145, 0, .215, 0, alloy, .006);
            box(body, gripper.fingerThickness, fit.fingerHeight, .105, 0, fit.fingerY, 0, alloy, .004);
            box(body, gripper.padThickness, gripper.padHeight, .095, -side * fit.padX, fit.padY, 0, rubber, .002);
            for (let i = 0; i < 3; i++) {
                box(body, .002, .006, .086, -side * (fit.padInnerX + .001), fit.padY - .017 + i * .015, 0, m.metal, 0);
            }
            bolt(body, 0, .244, -.059, .010);
            return { jaw, side };
        });
        return { tool, jaws };
    }

    function buildFixture(point, name) {
        const nest = group(fixed, point.x, 0, point.z); nest.name = name;
        const floorBottom = fixtureSize.floorTop - fixtureSize.floorThickness;
        box(nest, .32, .040, .275, 0, floorBottom - .012 - .020, 0, rubber, .013);
        box(nest, .28, .012, .237, 0, floorBottom - .006, 0, alloy, .008);
        box(nest, partSize.width + .015, fixtureSize.floorThickness, partSize.depth + .015, 0, fixtureSize.floorTop - fixtureSize.floorThickness / 2, 0, m.black, .003);
        for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) {
            cylinder(nest, .012, .012, fixtureSize.supportHeight, sideX * (partSize.width / 2 - .015), fit.supportY, sideZ * (partSize.depth / 2 - .020), m.cream, 10);
        }
        // Pins locate the PCB in z; the x edges remain clear for the fingers.
        const pinRadius = .014, pinClearance = .005;
        for (const side of [-1, 1]) cylinder(nest, .012, pinRadius, .057, 0, fixtureSize.floorTop + .017, side * (partSize.depth / 2 + pinRadius + pinClearance), m.gold, 12);
        for (const x of [-.124, .124]) for (const z of [-.096, .096]) bolt(nest, x, floorBottom + .004, z, .010, 'y');
    }
    function buildPart(parent, name, x, y, z) {
        const part = group(parent, x, y, z); part.name = name;
        const detail = assembly(part, 'arm-part-detail'), top = partSize.thickness / 2;
        box(detail, partSize.width, partSize.thickness, partSize.depth, 0, 0, 0, m.pcb, .003);
        box(detail, .052, .021, .045, -.009, top + .0105, 0, rubber, .002);
        for (const side of [-1, 1]) for (let i = 0; i < 4; i++) box(detail, .007, .006, .012, -.029 + i * .013, top + .003, side * .030, alloy, 0);
        for (let i = 0; i < 4; i++) box(detail, .012, .002, .022, -.049 + i * .026, top + .001, .047, m.gold, 0);
        box(detail, .022, .012, .034, .046, top + .006, -.020, m.cream, .002);
        return part;
    }
    function buildFixtures(tool) {
        buildFixture(ARM.pick, 'arm-pick-fixture'); buildFixture(ARM.place, 'arm-place-fixture');
        const pickup = buildPart(root, 'arm-pickup-part', ARM.pick.x, fit.partY, ARM.pick.z);
        const delivered = buildPart(root, 'arm-delivered-part', ARM.place.x, fit.partY, ARM.place.z);
        const carried = buildPart(tool, 'arm-carried-part', 0, gripper.toolLength, 0);
        carried.rotation.z = Math.PI;
        return { pickup, delivered, carried };
    }

    // Reuse tube buffers and normals. A paused joint does not regenerate/upload them.
    function createJointCable(parent, centerY, reach) {
        const segments = 18, sides = 6, radius = .010;
        const geometry = own(new THREE.BufferGeometry());
        const positions = new Float32Array((segments + 1) * (sides + 1) * 3);
        const normals = new Float32Array(positions.length), indices = [];
        for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
            const a = i * (sides + 1) + j, b = a + sides + 1;
            indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setIndex(indices);
        const mesh = new THREE.Mesh(geometry, rubber); mesh.name = 'arm-joint-service-loop';
        mesh.position.y = centerY; mesh.castShadow = true; parent.add(mesh);
        let previous = NaN;
        return angle => {
            if (angle === previous) return;
            previous = angle;
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const ax = loom.x, ay = loom.incomingY, bx = -reach, by = -.13;
            const cx = -reach * cos - loom.outgoingY * sin, cy = -reach * sin + loom.outgoingY * cos;
            const dx = loom.x * cos - loom.outgoingY * sin, dy = loom.x * sin + loom.outgoingY * cos;
            for (let i = 0; i <= segments; i++) {
                const t = i / segments, u = 1 - t;
                const x = u ** 3 * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t ** 3 * dx;
                const y = u ** 3 * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t ** 3 * dy;
                const tx = 3 * u * u * (bx - ax) + 6 * u * t * (cx - bx) + 3 * t * t * (dx - cx);
                const ty = 3 * u * u * (by - ay) + 6 * u * t * (cy - by) + 3 * t * t * (dy - cy);
                const length = Math.hypot(tx, ty) || 1;
                for (let j = 0; j <= sides; j++) {
                    const a = j / sides * Math.PI * 2;
                    const nx = -ty / length * Math.cos(a), ny = tx / length * Math.cos(a), nz = Math.sin(a);
                    const index = (i * (sides + 1) + j) * 3;
                    positions[index] = x + nx * radius; positions[index + 1] = y + ny * radius; positions[index + 2] = loom.z + nz * radius;
                    normals[index] = nx; normals[index + 1] = ny; normals[index + 2] = nz;
                }
            }
            geometry.attributes.position.needsUpdate = geometry.attributes.normal.needsUpdate = true;
            geometry.computeBoundingSphere(); geometry.computeBoundingBox();
        };
    }
    function buildCables(yaw, { shoulder, elbow, wristBody }) {
        const shoulderCable = createJointCable(yaw, ARM.shoulderY - ARM.yawY, .27);
        const elbowCable = createJointCable(shoulder, ARM.upper, .25);
        const wristCable = createJointCable(elbow, ARM.forearm, .22);
        // Terminate on the stationary wrist housing, before the internal roll joint.
        cable(wristBody, [[loom.x, loom.outgoingY, loom.z], [-.10, .17, -.19], [-.075, .12, -.13], [-.06, .08, -.09]], rubber, .012);
        return pose => {
            shoulderCable(pose.shoulder); elbowCable(pose.elbow); wristCable(pose.wrist);
        };
    }

    const decal = createDecals();
    const { yaw, status } = buildBase();
    const links = buildLinks(yaw);
    const { tool, jaws } = buildGripper(links.wrist);
    const { pickup, delivered, carried } = buildFixtures(tool);
    const updateCables = buildCables(yaw, links);
    for (const body of rigid) batch(body);

    function applyPose(pose) {
        yaw.rotation.y = pose.yaw;
        links.shoulder.rotation.z = pose.shoulder;
        links.elbow.rotation.z = pose.elbow;
        links.wrist.rotation.z = pose.wrist;
        // Counter-roll keeps the PCB aligned with both nests.
        tool.rotation.y = pose.roll;
        const jawX = THREE.MathUtils.lerp(fit.jawOpenX, fit.jawClosedX, pose.grip);
        for (const { jaw, side } of jaws) jaw.position.x = side * jawX;
        pickup.visible = pose.pickVisible; delivered.visible = pose.placedVisible; carried.visible = pose.carrying;
        updateCables(pose);
    }
    let time = 0;
    /**
     * @param {number} dt Nonnegative simulation seconds, clamped by the room.
     * @param {ArmControls} controls
     */
    function update(dt, { running, started }) {
        if (running) time += dt;
        const pose = sampleArmMotion(time, started);
        applyPose(pose);
        status.material = running ? m.mintGlow : m.amberGlow;
        return Math.round(pose.phase * 100);
    }
    update(0, { running: false, started: false });
    return { update };
}
