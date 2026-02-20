import { PRODUCT_CODE_SPECIAL_CASES, SKIP_WORDS } from '../types/product.types';
import type { ProductFormData } from '../types/product.types';

const skipWordsArray = SKIP_WORDS as readonly string[];

export function buildProductInitials(productName: string): string {
  const words = productName.trim().split(/\s+/);
  let initials = '';

  for (const word of words) {
    const lowerWord = word.toLowerCase();

    if (!/[a-zA-Z0-9]/.test(word)) {
      continue;
    }

    if (PRODUCT_CODE_SPECIAL_CASES[word]) {
      initials += PRODUCT_CODE_SPECIAL_CASES[word];
      continue;
    }

    if (skipWordsArray.includes(lowerWord)) {
      continue;
    }

    if (/[&/.+]/.test(word)) {
      const uppercaseLetters = word.match(/[A-Z]/g) ?? [];
      if (uppercaseLetters.length > 0) {
        initials += uppercaseLetters.join('');
      } else {
        const parts = word.split(/[^a-zA-Z0-9]+/);
        for (const part of parts) {
          if (part.length > 0) {
            initials += part[0].toUpperCase();
          }
        }
      }
    } else if (word.length > 0) {
      initials += word[0].toUpperCase();
    }
  }

  return initials;
}

export function formatPostingDateForProductCode(postingDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(postingDate)) {
    const [year, month, day] = postingDate.split('-');
    return `${month}${day}${year.slice(2)}`;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(postingDate)) {
    const [month, day, year] = postingDate.split('-');
    return `${month}${day}${year.slice(2)}`;
  }

  return postingDate;
}

export function generateFormattedProductCode(
  productName: string,
  postingDate: string
): string {
  if (!productName || !postingDate) {
    return '';
  }

  const initials = buildProductInitials(productName);
  const formattedDate = formatPostingDateForProductCode(postingDate);
  return `${productName} (${initials}-${formattedDate})`;
}

export function buildAgeRangeLabel(form: ProductFormData): string {
  if (form.ageRangeStart && form.ageRangeEnd && form.ageRangeUnit) {
    return `${form.ageRangeStart}-${form.ageRangeEnd} ${form.ageRangeUnit}`;
  }

  if (form.ageRangeEnd && form.ageRangeUnit) {
    return `${form.ageRangeEnd} ${form.ageRangeUnit}`;
  }

  if (form.ageRangeStart && form.ageRangeUnit) {
    return `${form.ageRangeStart} ${form.ageRangeUnit}`;
  }

  return form.ageRange || '';
}
