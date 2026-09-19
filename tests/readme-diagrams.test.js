const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const folder = 'docs/assets/readme';
const diagrams = ['site-map.svg', 'architecture.svg', 'publish-flow.svg'];
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

function source(name) {
    return fs.readFileSync(path.join(root, folder, name), 'utf8');
}

test('README uses three local SVG images instead of platform-rendered diagrams', () => {
    const images = [...readme.matchAll(/!\[([^\]]+)\]\((docs\/assets\/readme\/[^)]+)\)/g)];
    assert.deepEqual(images.map(([, , file]) => path.basename(file)), diagrams);
    for (const [, alt, file] of images) {
        assert.ok(alt.length > 10, 'Every diagram has meaningful alternative text');
        assert.ok(fs.existsSync(path.join(root, file)), file);
    }
    assert.doesNotMatch(readme, /```mermaid|mermaid\.js|mermaid\.mjs/i);
    assert.deepEqual(fs.readdirSync(path.join(root, folder)).sort(), [...diagrams].sort(), 'Only the SVG sources are maintained');
});

for (const name of diagrams) {
    test(`${name} is accessible, self-contained and independent of fonts and host themes`, () => {
        const svg = source(name);
        assert.ok(Buffer.byteLength(svg) < 128 * 1024, 'Keep each documentation image reasonably small');
        assert.match(svg, /<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        assert.match(svg, /viewBox="0 0 640 \d+"/);
        assert.match(svg, /role="img"\s+aria-labelledby="title desc"/);
        assert.match(svg, /<title id="title">[^<]+<\/title>/);
        assert.match(svg, /<desc id="desc">[^<]+<\/desc>/);
        assert.match(svg, /fill="#f7f3e8"/, 'The illustration carries its own paper background');
        assert.match(svg, /data-label="[^"]+"/, 'Outlined labels retain semantic text in the SVG source');
        assert.doesNotMatch(svg, /<(?:text|tspan|foreignObject|script|style|image|font|animate|animateTransform|set)\b/i);
        assert.doesNotMatch(svg, /@font-face|@import|prefers-color-scheme|currentColor|\bvar\(|\bon\w+\s*=/i);
        const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
        const known = new Set(ids);
        assert.equal(known.size, ids.length, 'IDs are unique within each image');
        const references = [...svg.matchAll(/\b(?:xlink:)?href="([^"]+)"/g)].map(([, value]) => value);
        assert.ok(references.length > 0, 'Labels reuse local vector glyphs');
        for (const reference of references) {
            assert.ok(reference.startsWith('#') && known.has(reference.slice(1)), `Local glyph reference resolves: ${reference}`);
        }
    });
}

test('diagram descriptions preserve the actual site, runtime and release boundaries', () => {
    const site = source('site-map.svg');
    for (const page of ['index.html', 'blog.html', 'tool.html', 'studio.html', 'about.html']) {
        assert.ok(site.includes(page), page);
        assert.ok(fs.existsSync(path.join(root, page)), page);
    }
    const architecture = source('architecture.svg');
    for (const concept of ['CDN', 'JavaScript', 'Marked.js', 'Three.js', 'CSS3D', 'localStorage', '没有应用后端', '真实 shell', 'giscus']) {
        assert.ok(architecture.includes(concept), concept);
    }
    const release = source('publish-flow.svg');
    for (const boundary of ['run.sh gen', 'run.sh deploy', '指定 Git 提交', '干净工作区', '凭据留在仓库之外']) {
        assert.ok(release.includes(boundary), boundary);
    }
});

test('documentation diagrams and tests stay outside the deployment artifact', () => {
    const attributes = execFileSync('git', ['check-attr', 'export-ignore', '--', 'README.md', 'docs', 'tests'], { cwd: root, encoding: 'utf8' });
    for (const entry of ['README.md', 'docs', 'tests']) {
        assert.ok(attributes.includes(`${entry}: export-ignore: set`), entry);
    }
});
