import type { RefuelRecord, FuelEfficiency } from "$lib/models/types";

/**
 * 満タン法で燃費を計算する
 *
 * - ODO があり isFullTank の記録同士を比較
 * - 間に非満タン給油がある場合はその給油量を合算
 * - ODO がない記録は燃費計算をスキップ (金額集計には含まれる)
 * - fuelAmount が未入力 (undefined) の場合:
 *   - 満タン＋ODO あり → 基準点としてリセット (燃費計算の区間は切れる)
 *   - それ以外 → スキップ (積算もしない)
 */
export function calculateFuelEfficiency(
  refuels: RefuelRecord[],
): FuelEfficiency[] {
  // 日付昇順でソート
  const sorted = [...refuels].sort((a, b) => (a.date < b.date ? -1 : 1));

  const results: FuelEfficiency[] = [];
  let lastFullTankOdo: number | null = null;
  let accumulatedFuel = 0;
  let hasUnknownFuel = false; // 区間内に fuelAmount 不明のレコードがあるか

  for (const record of sorted) {
    const hasFuel = record.fuelAmount != null && record.fuelAmount > 0;

    if (record.odometer == null) {
      // ODO なし → 燃費計算スキップ、ただし燃料は積算
      if (lastFullTankOdo != null && !record.isFullTank && hasFuel) {
        accumulatedFuel += record.fuelAmount!;
      }
      if (!hasFuel) hasUnknownFuel = true;
      continue;
    }

    if (record.isFullTank) {
      if (lastFullTankOdo != null && hasFuel && !hasUnknownFuel) {
        // fuelAmount がわかっていて、区間内に不明 fuel がなければ計算可能
        const distance = record.odometer - lastFullTankOdo;
        const totalFuel = accumulatedFuel + record.fuelAmount!;

        if (distance > 0 && totalFuel > 0) {
          results.push({
            date: record.date,
            kmPerLiter: Math.round((distance / totalFuel) * 100) / 100,
            distance,
            fuelAmount: totalFuel,
          });
        }
      }
      // 満タン＋ODO ありなら常に基準点をリセット
      lastFullTankOdo = record.odometer;
      accumulatedFuel = 0;
      hasUnknownFuel = false;
    } else {
      // 非満タン → 燃料だけ積算
      if (hasFuel) {
        accumulatedFuel += record.fuelAmount!;
      } else {
        hasUnknownFuel = true;
      }
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

/**
 * 総給油量 (fuelAmount が記録されているもののみ合算)
 */
export function getTotalFuel(refuels: RefuelRecord[]): number {
  return refuels.reduce((sum, r) => sum + (r.fuelAmount ?? 0), 0);
}

/**
 * 推定残燃料を計算する
 *
 * 最後に満タン給油した時点からの走行距離と平均燃費を使って
 * 消費量を推定し、タンク容量から引く。
 *
 * @returns 推定残燃料 (L) または null (計算不可)
 */
export function estimateRemainingFuel(
  refuels: RefuelRecord[],
  tankCapacity: number,
  avgKmPerLiter: number | null,
): { remaining: number; percentage: number } | null {
  if (!avgKmPerLiter || avgKmPerLiter <= 0 || tankCapacity <= 0) return null;

  // 最後の満タン給油 (日付降順で最初に見つかる isFullTank)
  const sorted = [...refuels].sort((a, b) => (a.date > b.date ? -1 : 1));
  const lastFullTank = sorted.find((r) => r.isFullTank && r.odometer != null);
  if (!lastFullTank) return null;

  // 最後の満タン給油以降の最新 ODO を取得
  // (全レコードから最新 ODO を取る)
  const allWithOdo = refuels
    .filter((r) => r.odometer != null)
    .sort((a, b) => b.odometer! - a.odometer!);
  if (allWithOdo.length === 0) return null;

  const latestOdo = allWithOdo[0].odometer!;
  const distanceSinceFullTank = latestOdo - lastFullTank.odometer!;

  if (distanceSinceFullTank < 0) return null;

  // 満タン以降に追加給油があればその分を加算
  const additionalFuel = sorted
    .filter(
      (r) =>
        !r.isFullTank &&
        r.fuelAmount != null &&
        r.date >= lastFullTank.date &&
        r !== lastFullTank,
    )
    .reduce((sum, r) => sum + (r.fuelAmount ?? 0), 0);

  const estimatedConsumed = distanceSinceFullTank / avgKmPerLiter;
  const remaining = Math.max(
    0,
    Math.min(tankCapacity, tankCapacity + additionalFuel - estimatedConsumed),
  );
  const percentage = Math.round((remaining / tankCapacity) * 100);

  return { remaining: Math.round(remaining * 10) / 10, percentage };
}
