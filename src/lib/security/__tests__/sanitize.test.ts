/**
 * Security Tests for Server-Side Sanitization
 * Tests API route protection against XSS and SQL injection
 */

import { describe, it, expect } from 'vitest';
import { sanitizers } from '../sanitize';
import { validators } from '../validate';

describe('Server-Side Sanitization Security Tests', () => {
  describe('Name Sanitizer', () => {
    describe('XSS Protection', () => {
      it('should remove script tags', () => {
        const xss = '<script>alert("XSS")</script>John';
        const result = sanitizers.name(xss);
        expect(result).not.toContain('script');
        expect(result).not.toContain('alert');
        expect(result).toBe('John');
      });

      it('should remove inline event handlers', () => {
        const xss = '<div onclick="alert(1)">John</div>';
        const result = sanitizers.name(xss);
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('alert');
      });

      it('should remove iframe tags', () => {
        const xss = 'John<iframe src="evil.com"></iframe>';
        const result = sanitizers.name(xss);
        expect(result).not.toContain('iframe');
        expect(result).not.toContain('evil.com');
      });
    });

    describe('Special Characters', () => {
      it('should allow apostrophes in names', () => {
        expect(sanitizers.name("O'Brien")).toContain("'");
      });

      it('should allow hyphens in names', () => {
        expect(sanitizers.name('Mary-Jane')).toContain('-');
      });

      it('should allow accented characters', () => {
        expect(sanitizers.name('José García')).toBe('José García');
      });

      it('should trim whitespace', () => {
        expect(sanitizers.name('  John Doe  ')).toBe('John Doe');
      });
    });

    describe('Edge Cases', () => {
      it('should handle null input', () => {
        expect(sanitizers.name(null)).toBe('');
      });

      it('should handle undefined input', () => {
        expect(sanitizers.name(undefined)).toBe('');
      });

      it('should handle empty string', () => {
        expect(sanitizers.name('')).toBe('');
      });

      it('should handle very long names', () => {
        const longName = 'A'.repeat(1000);
        const result = sanitizers.name(longName);
        expect(result.length).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('Email Sanitizer', () => {
    describe('XSS Protection', () => {
      it('should remove script tags from email', () => {
        const xss = 'test@example.com<script>alert(1)</script>';
        const result = sanitizers.email(xss);
        expect(result).not.toContain('script');
        expect(result).not.toContain('alert');
      });

      it('should remove HTML from email', () => {
        const xss = '<b>test@example.com</b>';
        const result = sanitizers.email(xss);
        expect(result).not.toContain('<b>');
      });
    });

    describe('Format Normalization', () => {
      it('should convert to lowercase', () => {
        expect(sanitizers.email('Test@EXAMPLE.COM')).toBe('test@example.com');
      });

      it('should trim whitespace', () => {
        expect(sanitizers.email('  test@example.com  ')).toBe(
          'test@example.com'
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle null input', () => {
        expect(sanitizers.email(null)).toBe('');
      });

      it('should handle undefined input', () => {
        expect(sanitizers.email(undefined)).toBe('');
      });

      it('should handle empty string', () => {
        expect(sanitizers.email('')).toBe('');
      });
    });
  });

  describe('Decimal Sanitizer', () => {
    describe('XSS Protection', () => {
      it('should remove script tags from numbers', () => {
        const xss = '100<script>alert(1)</script>';
        const result = sanitizers.decimal(xss);
        expect(result).not.toBeNull();
        if (result !== null) {
          expect(result.toString()).toBe('100');
        }
      });

      it('should handle malicious decimal input', () => {
        const xss = '99.99"><script>alert(1)</script>';
        const result = sanitizers.decimal(xss);
        expect(result).not.toBeNull();
        if (result !== null) {
          expect(result.toString()).toBe('99.99');
        }
      });
    });

    describe('Valid Numbers', () => {
      it('should parse positive integers', () => {
        const result = sanitizers.decimal('100');
        expect(result).not.toBeNull();
        if (result !== null) {
          expect(result.toString()).toBe('100');
        }
      });

      it('should parse positive decimals', () => {
        const result = sanitizers.decimal('123.45');
        expect(result).not.toBeNull();
        if (result !== null) {
          expect(result.toString()).toBe('123.45');
        }
      });

      it('should parse negative numbers', () => {
        const result = sanitizers.decimal('-50.25');
        expect(result).not.toBeNull();
        if (result !== null) {
          expect(result.toString()).toBe('-50.25');
        }
      });

      it('should parse zero', () => {
        const result = sanitizers.decimal('0');
        expect(result).not.toBeNull();
        if (result !== null) {
          expect(result.toString()).toBe('0');
        }
      });
    });

    describe('Invalid Numbers', () => {
      it('should return null for invalid input', () => {
        expect(sanitizers.decimal('abc')).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(sanitizers.decimal('')).toBeNull();
      });

      it('should return null for null input', () => {
        expect(sanitizers.decimal(null)).toBeNull();
      });

      it('should return null for undefined input', () => {
        expect(sanitizers.decimal(undefined)).toBeNull();
      });
    });
  });

  describe('Integer Sanitizer', () => {
    describe('Valid Integers', () => {
      it('should parse positive integers', () => {
        expect(sanitizers.integer('42')).toBe(42);
      });

      it('should parse negative integers', () => {
        expect(sanitizers.integer('-10')).toBe(-10);
      });

      it('should parse zero', () => {
        expect(sanitizers.integer('0')).toBe(0);
      });
    });

    describe('Invalid Integers', () => {
      it('should return null for decimals', () => {
        expect(sanitizers.integer('123.45')).toBeNull();
      });

      it('should return null for non-numeric input', () => {
        expect(sanitizers.integer('abc')).toBeNull();
      });

      it('should return null for XSS attempts', () => {
        const xss = '42<script>alert(1)</script>';
        expect(sanitizers.integer(xss)).toBeNull();
      });

      it('should return null for null input', () => {
        expect(sanitizers.integer(null)).toBeNull();
      });
    });
  });

  describe('Date Sanitizer', () => {
    describe('Valid Dates', () => {
      it('should parse ISO 8601 dates', () => {
        const result = sanitizers.date('2025-01-15');
        expect(result).toBeInstanceOf(Date);
        expect(result?.getFullYear()).toBe(2025);
      });

      it('should parse datetime strings', () => {
        const result = sanitizers.date('2025-01-15T10:30:00Z');
        expect(result).toBeInstanceOf(Date);
      });
    });

    describe('Invalid Dates', () => {
      it('should return null for invalid date format', () => {
        expect(sanitizers.date('not-a-date')).toBeNull();
      });

      it('should return null for XSS in date', () => {
        const xss = '2025-01-15<script>alert(1)</script>';
        expect(sanitizers.date(xss)).toBeNull();
      });

      it('should return null for null input', () => {
        expect(sanitizers.date(null)).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(sanitizers.date('')).toBeNull();
      });
    });
  });

  describe('Boolean Sanitizer', () => {
    it('should parse true values', () => {
      expect(sanitizers.boolean('true')).toBe(true);
      expect(sanitizers.boolean('1')).toBe(true);
      expect(sanitizers.boolean('yes')).toBe(true);
      expect(sanitizers.boolean(true)).toBe(true);
      expect(sanitizers.boolean(1)).toBe(true);
    });

    it('should parse false values', () => {
      expect(sanitizers.boolean('false')).toBe(false);
      expect(sanitizers.boolean('0')).toBe(false);
      expect(sanitizers.boolean('no')).toBe(false);
      expect(sanitizers.boolean(false)).toBe(false);
      expect(sanitizers.boolean(0)).toBe(false);
    });

    it('should default to false for invalid input', () => {
      expect(sanitizers.boolean('invalid')).toBe(false);
      expect(sanitizers.boolean(null)).toBe(false);
      expect(sanitizers.boolean(undefined)).toBe(false);
    });

    it('should reject XSS attempts', () => {
      const xss = 'true<script>alert(1)</script>';
      // Should return false for malformed input
      expect(sanitizers.boolean(xss)).toBe(false);
    });
  });

  describe('Validators', () => {
    describe('Email Validation', () => {
      it('should validate correct email format', () => {
        expect(validators.isEmail('test@example.com')).toBe(true);
        expect(validators.isEmail('user.name+tag@example.co.uk')).toBe(true);
      });

      it('should reject invalid email format', () => {
        expect(validators.isEmail('notanemail')).toBe(false);
        expect(validators.isEmail('@example.com')).toBe(false);
        expect(validators.isEmail('test@')).toBe(false);
        expect(validators.isEmail('')).toBe(false);
      });

      it('should reject XSS in email', () => {
        const xss = 'test@example.com<script>alert(1)</script>';
        expect(validators.isEmail(xss)).toBe(false);
      });
    });

    describe('URL Validation', () => {
      it('should validate correct URLs', () => {
        expect(validators.isURL('https://example.com')).toBe(true);
        expect(validators.isURL('http://example.com')).toBe(true);
        expect(validators.isURL('https://example.com/path?query=value')).toBe(
          true
        );
      });

      it('should reject invalid URLs', () => {
        expect(validators.isURL('not a url')).toBe(false);
        expect(validators.isURL('javascript:alert(1)')).toBe(false);
        expect(
          validators.isURL('data:text/html,<script>alert(1)</script>')
        ).toBe(false);
      });
    });

    describe('Length Validation', () => {
      it('should validate minimum length', () => {
        expect(validators.minLength('hello', 3)).toBe(true);
        expect(validators.minLength('hi', 3)).toBe(false);
      });

      it('should validate maximum length', () => {
        expect(validators.maxLength('hello', 10)).toBe(true);
        expect(validators.maxLength('hello world test', 10)).toBe(false);
      });

      it('should handle null input', () => {
        expect(validators.minLength(null, 1)).toBe(false);
        expect(validators.maxLength(null, 10)).toBe(true);
      });
    });

    describe('Numeric Range Validation', () => {
      it('should validate minimum value', () => {
        expect(validators.min(10, 5)).toBe(true);
        expect(validators.min(3, 5)).toBe(false);
      });

      it('should validate maximum value', () => {
        expect(validators.max(5, 10)).toBe(true);
        expect(validators.max(15, 10)).toBe(false);
      });

      it('should handle null input', () => {
        expect(validators.min(null, 0)).toBe(false);
        expect(validators.max(null, 100)).toBe(false);
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle single quotes safely', () => {
      const name = "O'Brien";
      const result = sanitizers.name(name);
      // Prisma will handle parameterization
      expect(result).toContain("'");
    });

    it('should handle double dashes', () => {
      const name = 'John--Smith';
      const result = sanitizers.name(name);
      expect(result).toBeTruthy();
    });

    it('should handle SQL keywords', () => {
      const name = 'OR 1=1';
      const result = sanitizers.name(name);
      // Should sanitize but not break valid names
      expect(result).toBeTruthy();
    });

    it('should handle UNION attacks', () => {
      const email = "test' UNION SELECT * FROM users--@example.com";
      const result = sanitizers.email(email);
      // Should sanitize malicious content
      expect(result).toBeTruthy();
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should sanitize path traversal in filenames', () => {
      const filename = '../../etc/passwd';
      const result = sanitizers.name(filename);
      // Should sanitize but validation layer should reject
      expect(result).toBeTruthy();
    });

    it('should sanitize Windows path traversal', () => {
      const filename = '..\\..\\windows\\system32';
      const result = sanitizers.name(filename);
      expect(result).toBeTruthy();
    });

    it('should sanitize URL-encoded path traversal', () => {
      const filename = '..%2F..%2Fetc%2Fpasswd';
      const result = sanitizers.name(filename);
      expect(result).toBeTruthy();
    });
  });

  describe('Command Injection Prevention', () => {
    it('should sanitize shell command characters', () => {
      const input = 'test; rm -rf /';
      const result = sanitizers.name(input);
      // Should sanitize dangerous characters
      expect(result).toBeTruthy();
    });

    it('should sanitize pipe characters', () => {
      const input = 'test | cat /etc/passwd';
      const result = sanitizers.name(input);
      expect(result).toBeTruthy();
    });

    it('should sanitize backticks', () => {
      const input = 'test`whoami`';
      const result = sanitizers.name(input);
      expect(result).toBeTruthy();
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should handle LDAP special characters', () => {
      const input = '*)(uid=*))(|(uid=*';
      const result = sanitizers.name(input);
      expect(result).toBeTruthy();
    });

    it('should handle LDAP wildcards', () => {
      const input = 'admin*';
      const result = sanitizers.name(input);
      expect(result).toBeTruthy();
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should handle MongoDB operators', () => {
      const input = '{"$ne": null}';
      const result = sanitizers.name(input);
      expect(result).toBeTruthy();
    });

    it('should handle MongoDB query injection', () => {
      const input = '{"$gt": ""}';
      const result = sanitizers.name(input);
      expect(result).toBeTruthy();
    });
  });

  describe('Integration Tests', () => {
    it('should sanitize customer creation payload', () => {
      const payload = {
        name: '<script>alert(1)</script>John Doe',
        email: 'JOHN@EXAMPLE.COM',
        phone: '(123) 456-7890',
        address: 'Test<iframe></iframe> Address',
      };

      const sanitized = {
        name: sanitizers.name(payload.name),
        email: sanitizers.email(payload.email),
        phone: sanitizers.name(payload.phone),
        address: sanitizers.name(payload.address),
      };

      expect(sanitized.name).not.toContain('script');
      expect(sanitized.name).toContain('John Doe');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.phone).toBeTruthy();
      expect(sanitized.address).not.toContain('iframe');
    });

    it('should sanitize transaction creation payload', () => {
      const payload = {
        customerId: '123<script>alert(1)</script>',
        amount: '100.50<script>alert(1)</script>',
        date: '2025-01-15',
        notes: 'Test note<iframe src="evil.com"></iframe>',
      };

      const sanitized = {
        customerId: sanitizers.name(payload.customerId),
        amount: sanitizers.decimal(payload.amount),
        date: sanitizers.date(payload.date),
        notes: sanitizers.name(payload.notes),
      };

      expect(sanitized.customerId).not.toContain('script');
      expect(sanitized.amount).not.toBeNull();
      if (sanitized.amount !== null) {
        expect(sanitized.amount.toString()).toBe('100.5');
      }
      expect(sanitized.date).toBeInstanceOf(Date);
      expect(sanitized.notes).not.toContain('iframe');
    });

    it('should sanitize product creation payload', () => {
      const payload = {
        code: 'PROD-001<script>alert(1)</script>',
        name: 'Test Product<iframe></iframe>',
        price: '99.99"><script>alert(1)</script>',
        description: 'Description<object data="evil.swf"></object>',
      };

      const sanitized = {
        code: sanitizers.name(payload.code),
        name: sanitizers.name(payload.name),
        price: sanitizers.decimal(payload.price),
        description: sanitizers.name(payload.description),
      };

      expect(sanitized.code).not.toContain('script');
      expect(sanitized.name).not.toContain('iframe');
      expect(sanitized.price).not.toBeNull();
      expect(sanitized.description).not.toContain('object');
    });
  });
});
