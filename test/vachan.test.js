import {expect} from 'chai';
import {Vachan} from '../src/index';

describe('@vachan library', () => {
	it('mapValues should return right', async () => {
        const obj = {
            key1: [1, 2, 3],
            key2: [3, 5, 2],
            key3: [9, 7, 0],
        };
        const res = await Vachan.mapValues(obj, (val) => {
            return Promise.resolve(Math.max(...val));
        });
        expect(res).to.include.key('key1');
        expect(res).to.include.key('key2');
        expect(res).to.include.key('key3');
        expect(res.key1).to.equal(3);
        expect(res.key2).to.equal(5);
        expect(res.key3).to.equal(9);
    });

    it('mapkeys should return right', async () => {
        const obj = {
            key1: [1, 2, 3],
            key2: [3, 5, 2],
            key3: [9, 7, 0],
        };
        const res = await Vachan.mapKeys(obj, (val) => {
            return Promise.resolve(Math.max(...val));
        });
        expect(res).to.include.key('3');
        expect(res).to.include.key('5');
        expect(res).to.include.key('9');
        expect(res['3']).to.include.members([1,2,3]);
        expect(res['5']).to.include.members([3,5,2]);
        expect(res['9']).to.include.members([9,7,0]);
	});
})
