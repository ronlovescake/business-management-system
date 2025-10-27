/**
 * Client-side Performance Monitor Component
 * 
 * Tracks Web Vitals and sends to analytics
 */

'use client';

import { useEffect } from 'react';
import { trackWebVitals } from '@/lib/performance/monitoring';
import { logger } from '@/lib/logger';

export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize Web Vitals tracking
    trackWebVitals();
    
    logger.performance('Performance monitoring initialized', {
      timestamp: new Date().toISOString(),
    });
  }, []);

  // This component doesn't render anything
  return null;
}
