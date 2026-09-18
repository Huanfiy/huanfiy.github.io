/* Fixed measurement hardware. The room owns placement, batching and disposal;
 * artwork receives explicit snapshots, never the room's mutable simulation state. */
import * as THREE from 'three';
import { createInstrumentArtwork } from './studio-instrument-art.js';

// Shared by the solid controls and their printed legends. All coordinates are
// instrument-local; only the room translates the stack onto the workbench.
const layout = {
    scope: {
        panel: { width: 1.305, height: .699, y: .414, z: .364, atlas: [0, 0, 1024, 600] },
        axes: [{ x: .407, y: .451, r: .046, accent: 'yellow', angle: -.65 }, { x: .559, y: .451, r: .046, accent: 'teal', angle: .72 }],
        trigger: { x: .420, y: .264, r: .035, accent: 'orange', angle: -.35 },
        keys: [{ x: .404, y: .686, w: .102, label: 'RUN/STOP', accent: 'sage' }, { x: .557, y: .686, w: .102, label: 'AUTO', accent: 'orange' }, { x: .562, y: .275, w: .065, label: 'SINGLE', accent: 'sage' }],
        channels: [
            { x: -.36, y: .110, accent: 'yellow', ink: '#9a742f' },
            { x: -.15, y: .110, accent: 'teal', ink: '#537666' },
            { x: .06, y: .110, accent: 'blue', ink: '#597981' },
            { x: .27, y: .110, accent: 'red', ink: '#a76551' }
        ]
    },
    supply: {
        panel: { width: 1.10, height: .360, y: .251, z: .348, atlas: [0, 600, 1024, 424] },
        axes: [{ x: .158, y: .315, r: .054, accent: 'teal', angle: -.55, label: 'VOLTAGE' }, { x: .413, y: .315, r: .054, accent: 'orange', angle: .80, label: 'CURRENT' }],
        outputs: [{ x: .146, y: .123, accent: 'rubber', label: '−' }, { x: .285, y: .123, accent: 'teal', label: 'earth' }, { x: .424, y: .123, accent: 'red', label: '+' }]
    }
};
const scopeTop = .785;
export const INSTRUMENT_MOUNTS = Object.freeze({
    supply: Object.freeze([.01, scopeTop, -.045]),
    probe: Object.freeze([layout.scope.channels[0].x, layout.scope.channels[0].y, .504])
});

export function createStudioInstruments({ scopeRoot, scopeFixed, supplyRoot, group, box, cylinder, bar, material, canvasTexture, surface, batch, own, m }) {
    const steel = material('instrumentSteel', { color: '#b2bbb5', metalness: .48, roughness: .42 });
    const sage = material('instrumentSage', { color: '#889b8b', roughness: .82 });
    const rubber = material('instrumentRubber', { color: '#293934', roughness: .76 });
    const red = material('instrumentRed', { color: '#cf735d', roughness: .78 });
    const yellow = material('instrumentYellow', { color: '#e1b55e', roughness: .76 });
    const palette = { ...m, steel, sage, rubber, red, yellow };
    const hardware = new Map();
    const cached = (key, make) => {
        if (!hardware.has(key)) hardware.set(key, own(make()));
        return hardware.get(key);
    };
    const mesh = (parent, geometry, mat, x, y, z) => {
        const object = new THREE.Mesh(geometry, mat);
        object.position.set(x, y, z); object.castShadow = object.receiveShadow = true;
        parent.add(object); return object;
    };
    function disc(parent, r, depth, x, y, z, mat, segments = 24) {
        const object = cylinder(parent, r, r, depth, x, y, z, mat, segments);
        object.rotation.x = Math.PI / 2; return object;
    }
    // Open sleeves and annular lips leave a real recess around the dielectric/pin,
    // rather than a solid cylinder with a black end. All front faces point along +z.
    function sleeve(parent, outer, inner, depth, x, y, z, mat, segments = 24) {
        const shell = cached(`sleeve:${outer}:${depth}:${segments}`, () => new THREE.CylinderGeometry(outer, outer, depth, segments, 1, true));
        mesh(parent, shell, mat, x, y, z).rotation.x = Math.PI / 2;
        const lip = cached(`lip:${outer}:${inner}:${segments}`, () => new THREE.RingGeometry(inner, outer, segments));
        mesh(parent, lip, mat, x, y, z + depth / 2);
        const bore = cached(`bore:${inner}:${depth}:${segments}`, () => {
            const geometry = new THREE.CylinderGeometry(inner, inner, depth, segments, 1, true);
            const index = geometry.index.array, normal = geometry.attributes.normal;
            // Reverse winding and normals to shade the inside of the barrel.
            for (let i = 0; i < index.length; i += 3) [index[i], index[i + 2]] = [index[i + 2], index[i]];
            for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
            return geometry;
        });
        mesh(parent, bore, mat, x, y, z).rotation.x = Math.PI / 2;
    }
    function fluted(parent, r, depth, x, y, z, mat, openEnded = false) {
        const geometry = cached(`fluted:${r}:${depth}:${openEnded}`, () => {
            const geometry = new THREE.CylinderGeometry(r, r, depth, 48, 1, openEnded);
            const p = geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const a = Math.atan2(p.getZ(i), p.getX(i)), scale = 1 + .045 * Math.cos(a * 24);
                p.setX(i, p.getX(i) * scale); p.setZ(i, p.getZ(i) * scale);
            }
            geometry.computeVertexNormals(); return geometry;
        });
        mesh(parent, geometry, mat, x, y, z).rotation.x = Math.PI / 2;
    }
    function knob(parent, { x, y, r, accent, angle }, z) {
        disc(parent, r + .008, .009, x, y, z + .0045, rubber);
        fluted(parent, r, .038, x, y, z + .026, steel);
        disc(parent, r * .86, .008, x, y, z + .049, m.cream);
        const face = group(parent, x, y, z + .054); face.rotation.z = angle;
        box(face, .006, r * .47, .002, 0, r * .47, 0, palette[accent], .001);
    }
    function screw(parent, x, y, z) {
        disc(parent, .009, .004, x, y, z, steel, 12);
        box(parent, .010, .0025, .001, x, y, z + .0025, rubber, 0);
    }
    function key(parent, x, y, z, w, h, mat) {
        box(parent, w + .008, h + .008, .008, x, y, z, rubber, .008);
        box(parent, w, h, .018, x, y, z + .010, mat, .008);
    }
    function vent(parent, x, y, z, side, width, height) {
        const frame = group(parent, x, y, z); frame.rotation.y = side * Math.PI / 2;
        box(frame, width + .025, height + .024, .008, 0, 0, 0, sage, .009);
        box(frame, width, height, .004, 0, 0, .005, rubber, .006);
        // Thin louvres have square folded edges; bevels here add unseen triangles.
        for (let i = 0; i < 7; i++) box(frame, width - .014, .014, .010, 0, -height / 2 + .016 + i * (height - .032) / 6, .009, sage, 0);
    }

    // Rubber feet meet the tabletop at local y=-.04. The four supply feet meet the
    // flat lid at scopeTop, with their footprint clear of its rounded perimeter.
    scopeRoot.name = 'bench-oscilloscope';
    const fixed = scopeFixed;
    box(fixed, 1.36, .75, .68, 0, scopeTop - .375, 0, m.cream, .055);
    box(fixed, 1.345, .727, .055, 0, .410, -.316, sage, .018);
    box(fixed, 1.32, .712, .022, 0, .414, .338, rubber, .007);
    const scopePanel = layout.scope.panel;
    box(fixed, scopePanel.width, scopePanel.height, .024, 0, scopePanel.y, scopePanel.z - .013, m.cream, .008);
    for (const x of [-.46, .46]) {
        box(fixed, .16, .075, .43, x, -.0025, -.015, rubber, .020);
        for (const z of [-.16, .13]) box(fixed, .125, .008, .055, x, -.035, z, m.black, .002);
    }
    for (const side of [-1, 1]) {
        vent(fixed, side * .681, .418, -.055, side, .31, .255);
        const grip = group(fixed, side * .682, .660, -.055); grip.rotation.y = side * Math.PI / 2;
        box(grip, .255, .060, .010, 0, 0, 0, rubber, .008);
        box(grip, .20, .024, .024, 0, 0, .008, sage, .008);
        for (const y of [.103, .718]) screw(fixed, side * .630, y, .365);
    }
    const art = createInstrumentArtwork(canvasTexture, layout);
    box(fixed, .835, .496, .025, -.20, .450, .369, sage, .008);
    box(fixed, .810, .473, .018, -.20, .450, .382, rubber, .006);
    const glass = surface(scopeRoot, .782, .442, -.20, .450, .392, art.scopeScreen.texture);
    glass.name = 'scope-display';
    for (const y of [.605, .510, .415, .320]) key(fixed, .255, y, .368, .030, .043, sage);
    for (const { x, y, w, accent } of layout.scope.keys) key(fixed, x, y, .368, w, .032, palette[accent]);
    for (const axis of layout.scope.axes) {
        knob(fixed, { ...axis, y: axis.y + .119, r: .026, accent: 'rubber' }, .366);
        knob(fixed, axis, .366);
    }
    knob(fixed, layout.scope.trigger, .366);
    disc(fixed, .023, .010, -.594, .726, .370, rubber);
    disc(fixed, .017, .008, -.594, .726, .379, sage);
    box(fixed, .068, .030, .010, -.558, .119, .369, steel, .003);
    box(fixed, .058, .021, .004, -.558, .119, .376, rubber, .001);
    box(fixed, .040, .005, .007, -.558, .115, .379, m.black, 0);
    for (let i = 0; i < 4; i++) box(fixed, .004, .002, .003, -.571 + i * .009, .118, .382, m.gold, 0);
    // BNC: coloured insulator, hex nut, hollow barrel, recessed dielectric/socket
    // and two bayonet lugs. CH1's coupling joins the room's existing probe cable.
    for (const { x, y, accent } of layout.scope.channels) {
        disc(fixed, .043, .010, x, y, .369, palette[accent]);
        disc(fixed, .034, .009, x, y, .380, steel, 6);
        sleeve(fixed, .029, .023, .040, x, y, .404, steel);
        disc(fixed, .022, .006, x, y, .391, rubber);
        disc(fixed, .017, .009, x, y, .400, m.cream);
        sleeve(fixed, .006, .003, .012, x, y, .407, m.gold, 12);
        for (const side of [-1, 1]) box(fixed, .008, .010, .011, x + side * .029, y, .410, steel, .002);
    }
    const [probeX, probeY, probeZ] = INSTRUMENT_MOUNTS.probe;
    fluted(fixed, .034, .032, probeX, probeY, .436, rubber);
    sleeve(fixed, .029, .018, .012, probeX, probeY, .458, steel);
    disc(fixed, .018, .040, probeX, probeY, probeZ - .020, rubber, 16);
    for (const x of [.489, .572]) {
        disc(fixed, .014, .006, x, .121, .369, rubber, 16);
        bar(fixed, [x, .121, .375], [x, .121, .391], .004, m.gold);
        bar(fixed, [x, .121, .391], [x, .135, .391], .004, m.gold);
    }

    // A static supply does not introduce an action, device ID or tour stop. Empty
    // output terminals correctly read zero current in the illustrative display.
    supplyRoot.name = 'bench-power-supply';
    const powerFixed = group(supplyRoot);
    for (const x of [-.44, .44]) for (const z of [-.21, .21]) {
        cylinder(powerFixed, .040, .044, .045, x, .0225, z, rubber, 16);
        cylinder(powerFixed, .028, .028, .009, x, .0495, z, steel, 12);
    }
    box(powerFixed, 1.15, .415, .64, 0, .2525, 0, sage, .040);
    box(powerFixed, 1.135, .394, .046, 0, .2525, -.304, rubber, .014);
    box(powerFixed, 1.114, .373, .020, 0, .251, .324, rubber, .007);
    const supplyPanel = layout.supply.panel;
    box(powerFixed, supplyPanel.width, supplyPanel.height, .022, 0, supplyPanel.y, supplyPanel.z - .012, m.cream, .007);
    for (const side of [-1, 1]) {
        vent(powerFixed, side * .576, .260, -.04, side, .32, .225);
        for (const y of [.104, .409]) screw(powerFixed, side * .526, y, .350);
    }
    box(powerFixed, .545, .252, .017, -.235, .289, .353, rubber, .006);
    const powerGlass = surface(supplyRoot, .512, .240, -.235, .289, .363, art.powerScreen.texture);
    powerGlass.name = 'power-supply-display';
    for (const axis of layout.supply.axes) knob(powerFixed, axis, .349);
    key(powerFixed, -.470, .104, .350, .045, .029, sage);
    disc(powerFixed, .007, .006, -.424, .104, .352, m.mintGlow, 12);
    // Insulating shoulders, knurled caps and recessed metal banana sockets.
    for (const { x, y, accent } of layout.supply.outputs) {
        const mat = palette[accent];
        disc(powerFixed, .034, .011, x, y, .354, mat);
        disc(powerFixed, .024, .017, x, y, .367, steel);
        fluted(powerFixed, .028, .025, x, y, .389, mat, true);
        sleeve(powerFixed, .021, .011, .013, x, y, .406, steel);
        disc(powerFixed, .010, .004, x, y, .391, rubber, 16);
    }
    // Rear cooling grille and recessed IEC inlet remain readable while orbiting.
    const rear = group(powerFixed, 0, .253, -.329); rear.rotation.y = Math.PI;
    disc(rear, .115, .008, -.24, 0, 0, rubber, 32);
    for (let i = -4; i <= 4; i++) {
        const y = i * .023, half = Math.sqrt(.108 ** 2 - y ** 2);
        box(rear, half * 2, .009, .009, -.24, y, .006, steel, 0);
    }
    box(rear, .160, .115, .018, .29, -.025, .003, rubber, .005);
    box(rear, .106, .070, .007, .29, -.025, .014, m.black, .003);
    for (const [x, y] of [[.265, -.04], [.315, -.04], [.29, -.004]]) box(rear, .007, .018, .009, x, y, .021, steel, .001);
    for (const x of [-.5, .5]) screw(rear, x, .125, .003);
    batch(powerFixed);

    function legends(parent, panel, name) {
        const { width, height, y, z, atlas } = panel;
        const plane = surface(parent, width, height, 0, y, z, art.faces.texture);
        // UV cropping keeps both panels on a single texture and upload.
        const uv = plane.geometry.attributes.uv;
        const vMin = 1 - (atlas[1] + atlas[3]) / art.faces.canvas.height;
        const span = atlas[3] / art.faces.canvas.height;
        for (let i = 0; i < uv.count; i++) uv.setY(i, vMin + uv.getY(i) * span);
        uv.needsUpdate = true; plane.material.depthWrite = false; plane.name = name;
    }
    legends(scopeRoot, scopePanel, 'scope-face-legends');
    legends(supplyRoot, supplyPanel, 'power-supply-face-legends');
    return { updateDisplay: art.updateScope };
}
