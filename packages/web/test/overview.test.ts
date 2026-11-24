import { describe, expect, it } from 'vitest';
import { analyzeFiles, generateSyntheticDistrict } from '@roster-radius/core';
import { alertCounts, disclosureSummary, sharedFieldsBySensitivity, usesDefaultWeights, vendorRows } from '../src/app/overview';

const district = generateSyntheticDistrict();

describe('the overview', async () => {
  const { report } = await analyzeFiles(district.files, { today: district.today });

  it('ranks vendors by student exposure, with their apps, channels and most sensitive data', () => {
    const rows = vendorRows(report, 'students');

    expect(rows.map((r) => r.vendorId)).toEqual(['Transit Apps LLC', 'Food Services Co', 'Family Messaging LLC', 'Library Systems Co', 'Acme Learning', 'Classroom Cloud Inc', 'QuizHub Inc']);
    expect(rows[0]).toMatchObject({ points: 33200, share: 1, topClass: 'Location', apps: ['RouteRider'], channels: ['SFTP'] });
    expect(rows.find((r) => r.vendorId === 'Acme Learning')).toMatchObject({ apps: ['ReadWell', 'MathPath'], channels: ['Clever', 'SFTP'] });
    expect(rows.find((r) => r.vendorId === 'Acme Learning')?.topFields).toHaveLength(3);
  });

  it('lists the most shared fields, the most sensitive first among equals', () => {
    const fields = sharedFieldsBySensitivity(report).map((f) => f.field);

    expect(fields.slice(0, 4)).toEqual(['student.frl_status', 'student.address', 'student.password', 'student.transportation']);
    expect(fields.indexOf('student.grade_level')).toBeGreaterThan(fields.indexOf('student.first_name'));
  });

  it('ranks the vendors that receive staff data apart', () => {
    expect(vendorRows(report, 'staff').map((r) => r.vendorId).sort()).toEqual(['Acme Learning', 'Classroom Cloud Inc']);
  });

  it('counts alerts by severity and summarizes the published list', () => {
    expect(alertCounts(report)).toEqual([
      { severity: 'critical', count: 1 },
      { severity: 'high', count: 6 },
      { severity: 'info', count: 4 },
    ]);
    expect(disclosureSummary(report)).toEqual({ receiving: 7, disclosed: 5, counts: { undisclosed_vendor: 2, undisclosed_app: 0, undisclosed_data: 3, no_longer_receives: 1 } });
    expect(usesDefaultWeights(report)).toBe(true);
  });
});
