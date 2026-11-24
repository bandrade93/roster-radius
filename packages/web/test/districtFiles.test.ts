import { describe, expect, it } from 'vitest';
import { EMPTY, forSlot, fromFolder, kindFromHeader, localToday, merge, missing, withoutSlot } from '../src/app/districtFiles';

const file = (name: string, text = 'x') => new File([text], name);
const picked = (paths: string[]) => paths.map((path) => ({ path, content: file(path.split('/').pop()!) }));

describe('sorting the files of a district folder', () => {
  it('puts each file in its place, by name and folder', async () => {
    const set = await fromFolder(
      picked([
        'district/inventory.csv',
        'district/contracts.csv',
        'district/declared.csv',
        'district/oneroster/users.csv',
        'district/oneroster/orgs.csv',
        'district/oneroster/demographics.csv',
        'district/exports/mathpath_students.csv',
        'district/README.md',
      ]),
    );

    expect(set.files.map((f) => `${f.slot} ${f.path}`)).toEqual([
      'inventory inventory.csv',
      'contracts contracts.csv',
      'declared declared.csv',
      'oneroster oneroster/users.csv',
      'oneroster oneroster/orgs.csv',
      'oneroster oneroster/demographics.csv',
      'vendorFiles exports/mathpath_students.csv',
    ]);
    expect(set.ignored).toEqual(['README.md']);
  });

  it('takes a OneRoster zip as the roster', async () => {
    expect((await fromFolder(picked(['roster.zip', 'inventory.csv']))).files.map((f) => f.slot)).toEqual(['oneroster', 'inventory']);
  });

  it('recognizes the inventory, contracts and published list by their header row, whatever their names', async () => {
    const set = await fromFolder([
      { path: 'Apps 2026.csv', content: file('Apps 2026.csv', 'app;vendor;channel;fields\nA;V;sftp;student.first_name') },
      { path: 'DPAs.csv', content: file('DPAs.csv', '\uFEFFcontract_id,vendor,end_date\nC1,V,2027-01-01') },
      { path: 'privacy page.csv', content: file('privacy page.csv', 'vendor,exhibit_b\nV,Student Name') },
      { path: 'students.csv', content: file('students.csv', 'Student_id\n1') },
    ]);

    expect(set.files.map((f) => `${f.slot} ${f.path} ${f.name}`)).toEqual([
      'inventory inventory.csv Apps 2026.csv',
      'contracts contracts.csv DPAs.csv',
      'declared declared.csv privacy page.csv',
      'vendorFiles students.csv students.csv',
    ]);
  });

  it('keeps a file named inventory.csv over another file that looks like one', async () => {
    const set = await fromFolder([
      { path: 'inventory.csv', content: file('inventory.csv', 'app,vendor,channel,fields') },
      { path: 'old inventory.csv', content: file('old inventory.csv', 'app,vendor,channel,fields') },
    ]);

    expect(set.files.map((f) => f.slot)).toEqual(['inventory', 'vendorFiles']);
  });

  it('reads the kind of table from its header', () => {
    expect(kindFromHeader('app,vendor,channel,fields,notes')).toBe('inventory');
    expect(kindFromHeader('contract_id,vendor,exhibit_b')).toBe('contracts');
    expect(kindFromHeader('vendor,apps,exhibit_b,published_on')).toBe('declared');
    expect(kindFromHeader('Student_id,First_name')).toBeUndefined();
  });
});

describe('choosing files for one place', () => {
  it('names the inventory, contracts and published list as the analysis expects, whatever they are called', () => {
    expect(forSlot('inventory', [file('Apps 2026.csv'), file('other.csv')]).map((f) => f.path)).toEqual(['inventory.csv']);
    expect(forSlot('contracts', [file('DPAs.csv')])[0]?.path).toBe('contracts.csv');
    expect(forSlot('declared', [file('privacy page.csv')])[0]?.path).toBe('declared.csv');
    expect(forSlot('oneroster', [file('users.csv'), file('export.zip')]).map((f) => f.path)).toEqual(['oneroster/users.csv', 'export.zip']);
    expect(forSlot('inventory', [file('Apps 2026.csv')])[0]?.name).toBe('Apps 2026.csv');
  });

  it('replaces a file with the same path, and removes a place', () => {
    const first = merge(EMPTY, { files: forSlot('inventory', [file('a.csv')]), ignored: [] });
    const second = merge(first, { files: forSlot('inventory', [file('b.csv')]), ignored: [] });

    expect(second.files.map((f) => f.name)).toEqual(['b.csv']);
    expect(withoutSlot(second, 'inventory').files).toEqual([]);
  });

  it('says what is still needed', async () => {
    expect(missing(EMPTY)).toEqual(['the app inventory', 'the OneRoster export']);
    expect(missing(await fromFolder(picked(['inventory.csv', 'roster.zip'])))).toEqual([]);
  });

  it('uses the date of the computer, not of Greenwich', () => {
    expect(localToday(new Date(2026, 10, 24, 23, 30))).toBe('2026-11-24');
  });
});
