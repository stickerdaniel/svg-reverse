import { describe, expect, test } from 'bun:test';
import { getPointAtLength, getTotalLength, splitPath } from 'svg-path-commander/util';
import { parseTimingClasses, reverseD, startPoint, timingClasses } from './svg.js';

// Points at evenly spaced fractions of each subpath's length, subpath by subpath.
function trace(d, steps = 16) {
    return splitPath(d).map(subpath => {
        const length = getTotalLength(subpath);
        return Array.from({ length: steps + 1 }, (_, i) => getPointAtLength(subpath, (length * i) / steps));
    });
}

// Asserts that `reversed` draws `original` backwards: subpaths in reverse order,
// and the point at fraction t of each subpath equals the original's at 1 - t
// (within 0.05, the precision of svg-path-commander's length lookup on curves).
function expectReversed(reversed, original) {
    const forward = trace(original);
    const backward = trace(reversed);
    expect(backward).toHaveLength(forward.length);
    backward.forEach((points, i) => {
        const expected = forward.at(-1 - i).toReversed();
        points.forEach((point, j) => {
            expect(point.x).toBeCloseTo(expected[j].x, 1);
            expect(point.y).toBeCloseTo(expected[j].y, 1);
        });
    });
}

describe('reverseD', () => {
    test.each([
        ['open line', 'M1 2 L3 4 L10 -5'],
        ['cubic curves', 'M99.36 333.52 C117.53 172.83 124.72 122.72 134.44 79.05 C143.31 39.31 157.68 22 180.5 22'],
        ['relative and implicit commands', 'm10 10 l5 0 5 5 h-3 v4 c1 2 3 4 5 6'],
        ['quadratic curves and T', 'M0 0 Q10 20 20 0 T40 0'],
        ['arcs with compact flags', 'M10 10 A5 8 30 0110 30 a4 4 0 1 0 8 8'],
        ['several open subpaths', 'M0 0 L10 0 M20 0 L20 10 M30 30 L40 40'],
        ['closed subpath ending away from start', 'M0 0 L10 0 L10 10 Z'],
        ['closed subpath ending at start', 'M0 0 C10 0 10 10 0 10 L0 0 Z'],
        ['closed and open subpaths mixed', 'M0 0 L10 0 L10 10 Z M50 50 L60 50 m5 5 l0 10 z'],
    ])('draws %s backwards', (_, d) => {
        expectReversed(reverseD(d), d);
    });

    test('closed subpaths start at their original start and keep Z', () => {
        const reversed = reverseD('M0 0 L10 0 L10 10 Z M50 50 L60 50 L60 60 Z');
        expect(reversed).toStartWith('M50 50');
        expect(reversed.match(/Z/g)).toHaveLength(2);
        expect(reversed).toEndWith('Z');
    });

    test.each([
        ['l', 'M10 10 L20 10 Z l5 5', 'M10 10 L20 10 Z M10 10 L15 15'],
        ['h and v', 'M10 10 L20 10 Z h5 v5', 'M10 10 L20 10 Z M10 10 L15 10 L15 15'],
        ['c', 'M10 10 C20 10 20 20 30 30 Z c1 2 3 4 5 6', 'M10 10 C20 10 20 20 30 30 Z M10 10 C11 12 13 14 15 16'],
        ['s', 'M10 10 C20 10 20 20 30 30 Z s3 4 5 6', 'M10 10 C20 10 20 20 30 30 Z M10 10 C10 10 13 14 15 16'],
        ['t', 'M10 10 Q20 10 30 30 Z t5 6', 'M10 10 Q20 10 30 30 Z M10 10 Q10 10 15 16'],
        ['a', 'M10 10 L20 10 Z a5 5 0 0 1 10 0', 'M10 10 L20 10 Z M10 10 A5 5 0 0 1 20 10'],
    ])('reverses relative %s after Z from the closed subpath start', (_, d, explicit) => {
        expectReversed(reverseD(d), explicit);
    });

    test.each([
        ['after C with a 0 control coordinate', 'M10 10 C20 0 0 20 10 30 S30 40 40 30', 'M10 10 C20 0 0 20 10 30 C20 40 30 40 40 30'],
        ['after Q', 'M10 10 Q20 0 30 10 S40 30 50 10', 'M10 10 Q20 0 30 10 C30 10 40 30 50 10'],
    ])('reflects S control points %s like SVG does', (_, d, explicit) => {
        expectReversed(reverseD(d), explicit);
    });

    test.each(['M5 6', 'M5 6Z', 'M1 2 M3 4', ''])('returns %p unchanged since it draws nothing', d => {
        expect(reverseD(d)).toBe(d);
    });
});

describe('startPoint', () => {
    test('is the start of the first drawing segment', () => {
        expect(startPoint('M100 100 M5 6 L10 10')).toBe('(5.000000, 6.000000)');
        expect(startPoint('M-1 -2.5 L10 0')).toBe('(-1.000000, -2.500000)');
        expect(startPoint('M10 10 Z l5 5')).toBe('(10.000000, 10.000000)');
    });

    test('shows the origin as coordinates', () => {
        expect(startPoint('M0 0 L10 0')).toBe('(0.000000, 0.000000)');
    });

    test.each([null, '', 'M5 6'])('is N/A for %p', d => {
        expect(startPoint(d)).toBe('N/A');
    });
});

describe('parseTimingClasses', () => {
    test('splits animation values from ordinary classes', () => {
        expect(parseTimingClasses('letter duration-0_5 delay-0_3 ease-power1_inOut')).toEqual({
            class: 'letter',
            duration: '0.5',
            delay: '0.3',
            easing: 'power1.inOut',
        });
    });

    test('keeps duplicate ordinary classes, lets the last timing class win and keeps "0"', () => {
        expect(parseTimingClasses('keep keep animate duration-2 duration-1_5 delay-0')).toEqual({
            class: 'keep keep animate',
            duration: '1.5',
            delay: '0',
        });
    });

    test('drops empty timing values', () => {
        expect(parseTimingClasses('keep duration-1 duration- delay- ease-')).toEqual({ class: 'keep' });
        expect(parseTimingClasses(null)).toEqual({});
    });
});

describe('timingClasses', () => {
    test('replaces existing timing classes and keeps "0" values', () => {
        const timing = { duration: '0', delay: '0', easing: 'power2.inOut' };
        expect(timingClasses('keep keep animate duration-2 delay-1 ease-power1_out', timing))
            .toBe('keep keep animate duration-0 delay-0 ease-power2_inOut');
    });

    test('removes timing classes of paths without values', () => {
        expect(timingClasses('untouched duration-9', undefined)).toBe('untouched');
        expect(timingClasses('duration-3 delay-2 ease-bounce_out', { duration: '', delay: '', easing: '' })).toBeNull();
        expect(timingClasses(null, {})).toBeNull();
    });
});
