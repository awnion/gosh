import { atom, atomFamily } from 'recoil';

const _test = atomFamily<any, any>({
    key: 'test',
    default: [],
});

export function testAtom() {
    return {
        t: _test('keey'),
    };
}
