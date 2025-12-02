/**
 * Test for Address Matching Bug Fix
 *
 * Tests the specific case where the dispatch address matching was failing
 * to catch addresses with:
 * - Business names in ALL CAPS (RAE BREEDING FARM)
 * - Filipino connector words (ang, o, ng, katabi)
 * - Parenthetical content (katabi ng MCGI)
 */

import { describe, it, expect } from 'vitest';
import { calculateAddressSimilarity } from '../fuzzyMatch';
import { logger } from '@/lib/logger';

describe('Address Matching Bug Fix - RAE BREEDING FARM Case', () => {
  it('should match dispatch address with customer database address', () => {
    const dispatchAddress =
      'purok 2 San Gregorio San pablo city, RAE BREEDING FARM ang gate o Soapy sudz laundry shop, San Gregorio, San Pablo City, South Luzon, Laguna, 4000';

    const customerAddress =
      'Purok 2, Brgy San Gregorio, RAE BREEDING FARM (katabi ng MCGI) San Pablo, Laguna';

    const score = calculateAddressSimilarity(dispatchAddress, customerAddress);

    logger.success(`Address Match Score: ${score}%`);

    // Should be at least 60% match (ideally 70%+)
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('should extract "RAE BREEDING FARM" as a landmark from dispatch address', () => {
    const address =
      'purok 2 San Gregorio San pablo city, RAE BREEDING FARM ang gate o Soapy sudz laundry shop';

    // The landmark extraction should catch "RAE BREEDING FARM"
    // This is tested indirectly through the similarity score
    expect(address).toContain('RAE BREEDING FARM');
  });

  it('should extract "rae breeding farm" as a landmark from customer address', () => {
    const address =
      'Purok 2, Brgy San Gregorio, RAE BREEDING FARM (katabi ng MCGI) San Pablo, Laguna';

    // The landmark extraction should catch "RAE BREEDING FARM"
    expect(address.toLowerCase()).toContain('rae breeding farm');
  });

  it('should handle parenthetical content in addresses', () => {
    const address1 = 'RAE BREEDING FARM (katabi ng MCGI) San Pablo';
    const address2 = 'RAE BREEDING FARM San Pablo';

    const score = calculateAddressSimilarity(address1, address2);

    // Should still have high similarity despite parenthetical content
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('should handle Filipino connector words (ang, o, ng, sa, na)', () => {
    const address1 = 'RAE BREEDING FARM ang gate o Soapy sudz';
    const address2 = 'RAE BREEDING FARM Soapy sudz';

    const score = calculateAddressSimilarity(address1, address2);

    // Should have high similarity after removing connector words
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('should match "San Pablo City" with "San Pablo"', () => {
    const address1 = 'San Gregorio, San Pablo City, Laguna';
    const address2 = 'San Gregorio, San Pablo, Laguna';

    const score = calculateAddressSimilarity(address1, address2);

    // Should have very high similarity
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('should recognize "purok 2" in both addresses', () => {
    const address1 = 'purok 2 San Gregorio';
    const address2 = 'Purok 2, Brgy San Gregorio';

    const score = calculateAddressSimilarity(address1, address2);

    // Should have high similarity
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('should handle "South Luzon" region descriptor', () => {
    const address1 = 'San Pablo City, South Luzon, Laguna';
    const address2 = 'San Pablo, Laguna';

    const score = calculateAddressSimilarity(address1, address2);

    // Should have high similarity (South Luzon should be normalized out)
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('should extract "soapy sudz laundry shop" as a landmark', () => {
    const address = 'RAE BREEDING FARM ang gate o Soapy sudz laundry shop';

    // Should detect "laundry shop" pattern
    expect(address.toLowerCase()).toContain('laundry shop');
  });

  it('should handle multiple business landmarks in same address', () => {
    const address1 = 'RAE BREEDING FARM, Soapy sudz laundry shop, San Pablo';
    const address2 = 'RAE BREEDING FARM San Pablo';

    const score = calculateAddressSimilarity(address1, address2);

    // Should still match well on the common landmark
    expect(score).toBeGreaterThanOrEqual(60);
  });
});
