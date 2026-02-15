import type { RefuelRecord, FuelEfficiency } from "$lib/models/types";

/**
 * 満タン法で燃費を計算する
 *
 * - ODO があり isFullTank の記録同士を比較
 * - 間に非満タン給油がある場合はその給油量を合算
 * - ODO がない記録は燃費計算をスキップ (金額集計には含まれる)
 */
export function calculateFuelEfficiency(
  refuels: RefuelRecord[],
): FuelEfficiency[] {
  // 日付昇順でソート
  const sorted = [...refuels].sort((a, b) => (a.date < b.date ? -1 : 1));

  const results: FuelEfficiency[] = [];
  let lastFullTankOdo: number | null = null;
  let accumulatedFuel = 0;

  for (const record of sorted) {
    if (record.odometer == null) {
      // ODO なし → 燃費計算スキップ、ただし燃料は積算
      if (lastFullTankOdo != null && !record.isFullTank) {
        accumulatedFuel += record.fuelAmount;
      }
      continue;
    }

    if (record.isFullTank) {
      if (lastFullTankOdo != null) {
        const distance = record.odometer - lastFullTankOdo;
        const totalFuel = accumulatedFuel + record.fuelAmount;

        if (distance > 0 && totalFuel > 0) {
          results.push({
            date: record.date,
            kmPerLiter: Math.round((distance / totalFuel) * 100) / 100,
            distance,
            fuelAmount: totalFuel,
          });
        }
      }
      lastFullTankOdo = record.odometer;
      accumulatedFuel = 0;
    } else {
      // 非満タン → 燃料だけ積算
      accumulatedFuel += record.fuelAmount;
    }
  }

  return results;
}

/**
 * 平均燃費を計算
 */
export function getAverageFuelEfficiency(
  efficiencies: FuelEfficiency[],
): number | null {
  if (efficiencies.length === 0) return null;
  // 加重平均 (距離 / 燃料合計)
  const totalDistance = efficiencies.reduce((sum, e) => sum + e.distance, 0);
  const totalFuel = efficiencies.reduce((sum, e) => sum + e.fuelAmount, 0);
  if (totalFuel === 0) return null;
  return Math.round((totalDistance / totalFuel) * 100) / 100;
}

/**
 * 直近燃費
 */
export function getLatestFuelEfficiency(
  efficiencies: FuelEfficiency[],
): number | null {
  if (efficiencies.length === 0) return null;
  return efficiencies[efficiencies.length - 1].kmPerLiter;
}

/**
 * 最高・最低燃費
 */
export function getBestWorstFuelEfficiency(efficiencies: FuelEfficiency[]): {
  best: number | null;
  worst: number | null;
} {
  if (efficiencies.length === 0) return { best: null, worst: null };
  const values = efficiencies.map((e) => e.kmPerLiter);
  return {
    best: Math.max(...values),
    worst: Math.min(...values),
  };
}

/**
 * 累計ガソリン代
 */
export function getTotalFuelCost(refuels: RefuelRecord[]): number {
  return refuels.reduce((sum, r) => sum + (r.totalCost ?? 0), 0);
}

/**
 * 総走行距離 (ODO ベース)
 */
export function getTotalDistance(refuels: RefuelRecord[]): number | null {
  const withOdo = refuels.filter((r) => r.odometer != null);
  if (withOdo.length < 2) return null;
  const sorted = withOdo.sort((a, b) => a.odometer! - b.odometer!);
  return sorted[sorted.length - 1].odometer! - sorted[0].odometer!;
}
