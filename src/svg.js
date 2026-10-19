// SVG processing for the browser: path extraction, path reversal with animation
// classes, and the downloadable animation zip.

import { parsePathString, reversePath, pathToString } from 'svg-path-commander/util';
import { zipSync, strToU8 } from 'fflate';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const SVG_PLACEHOLDER = '<!-- SVG_PLACEHOLDER -->';
const SCALE_STATEMENT = 'const animationScale = 1;';
const TIMING_PREFIXES = { duration: 'duration-', delay: 'delay-', easing: 'ease-' };

// Normalizes close-delimited chunks once, carrying the subpath start into the
// next chunk. The leading M lets the parser accept commands after Z and keeps
// relative m relative to that start; it is discarded if the chunk has its own M.
function segmentsOf(d) {
    let x = 0, y = 0;
    return d.split(/(?<=[Zz])/).flatMap((chunk, index) => {
        const segments = normalize(index === 0 ? chunk : `M${x} ${y}${chunk}`);
        const start = segments.findLast(([command]) => command === 'M');
        if (start) [, x, y] = start;
        return index > 0 && /^[\s,]*(?:[Mm]|$)/.test(chunk) ? segments.slice(1) : segments;
    });
}

// Converts path data to absolute M, L, C, Q, A and Z segments. S and T are expanded
// here because svg-path-commander 2.3.3 reflects S control points wrongly after a
// Q or A segment, or when the previous control point has a coordinate of 0.
function normalize(d) {
    let x = 0, y = 0, mx = 0, my = 0, cx = 0, cy = 0, qx = 0, qy = 0, last = '';
    return parsePathString(d).map(([command, ...values]) => {
        const type = command.toUpperCase();
        const [dx, dy] = command === type ? [0, 0] : [x, y];
        const points = values.map((n, i) => n + (i % 2 ? dy : dx));
        let segment;
        if (type === 'H') segment = ['L', values[0] + dx, y];
        else if (type === 'V') segment = ['L', x, values[0] + dy];
        else if (type === 'S') segment = ['C', ...(last === 'C' || last === 'S' ? [2 * x - cx, 2 * y - cy] : [x, y]), ...points];
        else if (type === 'T') segment = ['Q', ...(last === 'Q' || last === 'T' ? [2 * x - qx, 2 * y - qy] : [x, y]), ...points];
        else if (type === 'A') segment = ['A', ...values.slice(0, 5), values[5] + dx, values[6] + dy];
        else if (type === 'Z') segment = ['Z'];
        else segment = [type, ...points];

        [x, y] = type === 'Z' ? [mx, my] : segment.slice(-2);
        if (type === 'M') [mx, my] = [x, y];
        if (segment[0] === 'C') [cx, cy] = segment.slice(3, 5);
        if (segment[0] === 'Q') [qx, qy] = segment.slice(1, 3);
        last = type;
        return segment;
    });
}

const isDrawing = ([command]) => command !== 'M' && command !== 'Z';

// Reverses the drawing direction of path data like svgpathtools' Path.reversed():
// subpaths run last to first and each one is traversed backwards. A closed subpath
// starts at its original start point and keeps its Z. Path data without any
// drawing segment (empty or moveto only) is returned unchanged.
export function reverseD(d) {
    const segments = segmentsOf(d);
    if (!segments.some(isDrawing)) return d;
    const subpaths = segments.reduce((list, segment) => {
        if (segment[0] === 'M') list.push([segment]);
        else list.at(-1).push(segment);
        return list;
    }, []);
    const reversed = subpaths.map(subpath => {
        if (subpath.at(-1)[0] !== 'Z') return reversePath(subpath);
        const [, x, y] = subpath[0];
        const open = subpath.slice(0, -1);
        const [ex, ey] = open.at(-1).slice(-2);
        if (ex !== x || ey !== y) open.push(['L', x, y]);
        return [...reversePath(open), ['Z']];
    });
    return pathToString(reversed.reverse().flat(), 'off');
}

// Formats the start of the first drawing segment as "(x, y)" with six decimals,
// or "N/A" when the path data is missing or draws nothing.
export function startPoint(d) {
    if (!d) return 'N/A';
    const segments = segmentsOf(d);
    const first = segments.findIndex(isDrawing);
    if (first < 0) return 'N/A';
    const [x, y] = segments[first - 1].slice(-2);
    return `(${x.toFixed(6)}, ${y.toFixed(6)})`;
}

const splitClasses = classString => (classString ?? '').split(/\s+/).filter(Boolean);
const isTimingClass = cls => Object.values(TIMING_PREFIXES).some(prefix => cls.startsWith(prefix));

// Reads a class attribute into the ordinary classes and the animation values of
// duration-*, delay-* and ease-* classes (last one wins, "_" read as "."). Keys
// are only present when they have a non-empty value.
export function parseTimingClasses(classString) {
    const classes = splitClasses(classString);
    const result = {};
    const ordinary = classes.filter(cls => !isTimingClass(cls));
    if (ordinary.length) result.class = ordinary.join(' ');
    for (const [key, prefix] of Object.entries(TIMING_PREFIXES)) {
        const value = classes.findLast(cls => cls.startsWith(prefix))?.slice(prefix.length).replaceAll('_', '.');
        if (value) result[key] = value;
    }
    return result;
}

// Rewrites a class attribute: existing timing classes are replaced by the given
// duration, delay and easing ("." written as "_"). Returns null when no class is left.
export function timingClasses(existingClass, timing = {}) {
    const classes = splitClasses(existingClass).filter(cls => !isTimingClass(cls));
    for (const [key, prefix] of Object.entries(TIMING_PREFIXES)) {
        if (timing[key]) classes.push(prefix + timing[key].replaceAll('.', '_'));
    }
    return classes.length ? classes.join(' ') : null;
}

const parseXml = text => new DOMParser().parseFromString(text, 'image/svg+xml');
const parseErrorOf = doc => doc.getElementsByTagName('parsererror')[0];

// Parses SVG text into an XML document. Input whose root is not <svg>, such as a
// bare <path>, is wrapped in an <svg> element. Throws with the parser's message
// on malformed XML.
export function parseSvg(text) {
    const doc = parseXml(text);
    const error = parseErrorOf(doc);
    if (!error && doc.documentElement.localName === 'svg') return doc;
    const wrapped = parseXml(`<svg xmlns="${SVG_NS}">${text}</svg>`);
    const wrappedError = parseErrorOf(wrapped);
    if (!wrappedError) return wrapped;
    const report = error ?? wrappedError;
    throw new Error((report.querySelector('div') ?? report).textContent.trim());
}

// All <path> elements in the SVG namespace or in no namespace, in document order.
const pathsOf = doc => [...doc.documentElement.getElementsByTagName('*')]
    .filter(el => el.localName === 'path' && (el.namespaceURI === SVG_NS || el.namespaceURI === null));

const serialize = doc => new XMLSerializer().serializeToString(doc);

// Lists the paths of an SVG with their start point, attributes and animation
// values. Returns { paths, svg } where svg is the parsed SVG serialized again.
export function extractPaths(svgText) {
    const doc = parseSvg(svgText);
    const paths = pathsOf(doc).map((path, index) => {
        const d = path.getAttribute('d');
        const id = path.getAttribute('id');
        const attributes = Object.fromEntries([...path.attributes]
            .filter(attr => attr.namespaceURI !== XMLNS_NS)
            .map(attr => [attr.namespaceURI ? `{${attr.namespaceURI}}${attr.localName}` : attr.name, attr.value]));
        return {
            d,
            start: startPoint(d),
            attributes,
            index,
            ...(id && { id }),
            ...parseTimingClasses(path.getAttribute('class')),
        };
    });
    return { paths, svg: serialize(doc) };
}

// Reverses the paths at the given indexes and writes the animation classes of
// every path from pathData ([{ index, duration, delay, easing }]); paths without
// an entry lose their timing classes. Returns the updated SVG text.
export function reversePaths(svgText, indexes, pathData = []) {
    const doc = parseSvg(svgText);
    const selected = new Set(indexes.map(Number));
    const timing = new Map(pathData.map(item => [Number(item.index), item]));
    pathsOf(doc).forEach((path, index) => {
        if (selected.has(index)) {
            const d = path.getAttribute('d');
            if (d === null) throw new Error(`Path ${index} has no d attribute`);
            path.setAttribute('d', reverseD(d));
        }
        const classes = timingClasses(path.getAttribute('class'), timing.get(index));
        if (classes) path.setAttribute('class', classes);
        else path.removeAttribute('class');
    });
    return serialize(doc);
}

// Fetches a static text file and checks it is the expected one, since unknown
// paths are answered with the app's index.html.
async function fetchStatic(url, marker) {
    const res = await fetch(url);
    const text = res.ok ? await res.text() : '';
    if (!text.includes(marker)) throw new Error(`Could not load ${url}`);
    return text;
}

// Builds the downloadable animation: a zip Blob with anim.mjs and an index.html
// that embeds the SVG and plays it at the given speed scale.
export async function buildZip(svg, scale) {
    if (!svg) throw new Error('Modified SVG not provided');
    if (!scale) throw new Error('Animation scale not provided');
    const [anim, template] = await Promise.all([
        fetchStatic('/static/js/anim.mjs', 'animateSVGPaths'),
        fetchStatic('/static/zip_files/index.html', SVG_PLACEHOLDER),
    ]);
    const html = template
        .replaceAll(SVG_PLACEHOLDER, () => svg)
        .replaceAll(SCALE_STATEMENT, () => `const animationScale = ${scale};`);
    const zip = zipSync({ 'anim.mjs': strToU8(anim), 'index.html': strToU8(html) });
    return new Blob([zip], { type: 'application/zip' });
}
