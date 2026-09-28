/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NewsImpact = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface NewsEvent {
  id: string;
  eventName: string;
  country: string;
  impact: NewsImpact;
  scheduledTime: number; // Unix ms
  actualValue?: string;
  forecastValue?: string;
  previousValue?: string;
  source: string;
}

export interface NewsContext {
  activeEvents: NewsEvent[];
  upcomingHighImpactCount: number;
  nearestUpcomingEvent?: NewsEvent;
  minutesToNearestEvent?: number;
  isWithinHighImpactWindow: boolean;
  volatilityRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
}
